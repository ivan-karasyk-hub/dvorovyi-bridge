import { createServer } from 'http';
import { existsSync, readFileSync, statSync } from 'fs';
import { extname, join, resolve } from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { applyAction, createMatch, sanitizeStateForPlayer } from '../src/shared/gameEngine';
import { chooseBotAction } from '../src/shared/botEngine';
import {
  applyDurakAction,
  chooseDurakBotAction,
  createDurakMatch,
  sanitizeDurakStateForPlayer,
} from '../src/shared/durakEngine';
import {
  applyHoldemAction,
  chooseHoldemBotAction,
  createHoldemMatch,
  sanitizeHoldemStateForPlayer,
} from '../src/shared/holdemEngine';
import {
  getFriendsState,
  registerPlayerName,
  respondFriendRequest,
  sendFriendRequest,
} from './friends';
import { executeSlotSpin } from './slot';
import {
  addChips,
  claimRescueBonus,
  getLeaderboard,
  getOrCreateWallet,
  isAdminPlayer,
  normalizeTargetPlayerId,
} from './wallet';
import type {
  ClientMessage,
  DurakMode,
  DurakState,
  GameState,
  GameType,
  HoldemState,
  PublicRoomSummary,
  RoomInfo,
  RoomPlayerInfo,
  ServerMessage,
} from '../src/shared/types';

interface Room {
  code: string;
  gameType: GameType;
  durakMode: DurakMode;
  isPublic: boolean;
  password?: string;
  players: RoomPlayerInfo[];
  sockets: Map<string, WebSocket>;
  gameState: GameState | null;
  durakState: DurakState | null;
  holdemState: HoldemState | null;
  holdemStartingChips: Record<string, number>;
  botTimer: ReturnType<typeof setTimeout> | null;
}

const BOT_DELAY_MS = 1200;

const rooms = new Map<string, Room>();
const socketToPlayer = new Map<WebSocket, { code: string; playerId: string }>();
const socketPlayerIds = new Map<WebSocket, string>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function getPublicRoomsList(): PublicRoomSummary[] {
  const list: PublicRoomSummary[] = [];
  for (const room of rooms.values()) {
    if (!room.isPublic) continue;
    if (room.players.length >= 6) continue;
    const host = room.players.find((p) => p.isHost) ?? room.players[0];
    list.push({
      code: room.code,
      gameType: room.gameType,
      durakMode: room.durakMode,
      hostName: host?.name || 'Хост',
      playerCount: room.players.length,
      maxPlayers: 6,
      hasPassword: Boolean(room.password),
      started:
        room.gameState !== null || room.durakState !== null || room.holdemState !== null,
    });
  }
  return list;
}

function broadcastPublicRooms(): void {
  const list = getPublicRoomsList();
  for (const clientWs of wss.clients) {
    send(clientWs, { type: 'PUBLIC_ROOMS', rooms: list });
  }
}

function broadcastRoom(room: Room): void {
  const info: RoomInfo = {
    code: room.code,
    gameType: room.gameType,
    durakMode: room.durakMode,
    isPublic: room.isPublic,
    hasPassword: Boolean(room.password),
    players: room.players,
    started:
      room.gameState !== null || room.durakState !== null || room.holdemState !== null,
  };
  for (const [, ws] of room.sockets) {
    send(ws, { type: 'ROOM_STATE', room: info });
  }
  broadcastPublicRooms();
}

function getOnlinePlayerIds(): Set<string> {
  return new Set(socketPlayerIds.values());
}

function pushFriendsStateTo(playerId: string): void {
  const online = getOnlinePlayerIds();
  const fState = getFriendsState(playerId, online);
  for (const [clientWs, pid] of socketPlayerIds.entries()) {
    if (pid === playerId) {
      send(clientWs, {
        type: 'FRIENDS_STATE',
        friends: fState.friends,
        incomingRequests: fState.incomingRequests,
      });
    }
  }
}

function clearBotTimer(room: Room): void {
  if (room.botTimer) {
    clearTimeout(room.botTimer);
    room.botTimer = null;
  }
}

function scheduleBotTurnIfNeeded(room: Room): void {
  clearBotTimer(room);
  const state = room.gameState;
  if (!state || room.sockets.size === 0) return;
  if (
    state.phase !== 'playing' &&
    state.phase !== 'must_cover_six' &&
    state.phase !== 'choosing_suit' &&
    state.phase !== 'bridge_choice'
  ) {
    return;
  }

  const active = state.players[state.currentPlayerIndex];
  if (!active?.isBot) return;

    room.botTimer = setTimeout(() => {
      room.botTimer = null;
      if (!room.gameState || room.sockets.size === 0) return;
      const prev = room.gameState;
      const action = chooseBotAction(prev);
      if (!action) return;
      room.gameState = applyAction(prev, action);
      broadcastGameState(room);
      void rewardBridgeTransition(room, prev, room.gameState);
      scheduleBotTurnIfNeeded(room);
    }, BOT_DELAY_MS);
}

async function rewardBridgeTransition(
  room: Room,
  prevState: GameState | null,
  nextState: GameState,
): Promise<void> {
  if (!prevState) return;
  const enteredRoundEnd =
    (prevState.phase !== 'round_over' && nextState.phase === 'round_over') ||
    (prevState.phase !== 'match_over' && nextState.phase === 'match_over');
  if (!enteredRoundEnd || !nextState.roundWinnerId) return;

  const winner = nextState.players.find((p) => p.id === nextState.roundWinnerId);
  if (winner) {
    const bonus = nextState.roundWinReason === 'bridge' ? 100 : 50;
    const w = await addChips(winner.id, winner.name, bonus, false);
    const ws = room.sockets.get(winner.id);
    if (ws) send(ws, { type: 'WALLET_UPDATE', wallet: w });
  }

  if (nextState.phase === 'match_over') {
    const champion = nextState.players.find((p) => !p.eliminated);
    if (champion) {
      const w = await addChips(champion.id, champion.name, 200, true);
      const ws = room.sockets.get(champion.id);
      if (ws) send(ws, { type: 'WALLET_UPDATE', wallet: w });
    }
  }
}

async function rewardDurakTransition(
  room: Room,
  prevState: DurakState | null,
  nextState: DurakState,
): Promise<void> {
  if (!prevState) return;
  if (prevState.phase !== 'round_over' && nextState.phase === 'round_over') {
    for (const p of nextState.players) {
      if (p.id !== nextState.loserId) {
        const w = await addChips(p.id, p.name, 100, true);
        const ws = room.sockets.get(p.id);
        if (ws) send(ws, { type: 'WALLET_UPDATE', wallet: w });
      }
    }
  }
}

function scheduleDurakBotTurnIfNeeded(room: Room): void {
  clearBotTimer(room);
  const state = room.durakState;
  if (!state || room.sockets.size === 0 || state.phase !== 'playing') return;

  const botAction = chooseDurakBotAction(state);
  if (!botAction) return;

  room.botTimer = setTimeout(() => {
    room.botTimer = null;
    if (!room.durakState || room.sockets.size === 0) return;
    const prev = room.durakState;
    const nextAction = chooseDurakBotAction(prev);
    if (!nextAction) return;
    room.durakState = applyDurakAction(prev, nextAction);
    broadcastDurakState(room);
    void rewardDurakTransition(room, prev, room.durakState);
    scheduleDurakBotTurnIfNeeded(room);
  }, BOT_DELAY_MS);
}

function broadcastDurakState(room: Room): void {
  if (!room.durakState) return;
  for (const [playerId, ws] of room.sockets) {
    const sanitized = sanitizeDurakStateForPlayer(room.durakState, playerId);
    send(ws, { type: 'DURAK_STATE', state: sanitized });
  }
}

async function syncHoldemShowdownChips(
  room: Room,
  prevState: HoldemState | null,
  nextState: HoldemState,
): Promise<void> {
  if (!prevState) return;
  if (prevState.street !== 'showdown' && nextState.street === 'showdown') {
    for (const p of nextState.players) {
      if (p.isBot) continue;
      const startChips = room.holdemStartingChips[p.id] ?? p.chips;
      const delta = p.chips - startChips;
      room.holdemStartingChips[p.id] = p.chips;
      if (delta !== 0 || nextState.winnerIds.includes(p.id)) {
        const w = await addChips(
          p.id,
          p.name,
          delta,
          nextState.winnerIds.includes(p.id),
        );
        const ws = room.sockets.get(p.id);
        if (ws) send(ws, { type: 'WALLET_UPDATE', wallet: { ...w, isAdmin: isAdminPlayer(p.id) } });
      }
    }
  }
}

function scheduleHoldemBotTurnIfNeeded(room: Room): void {
  clearBotTimer(room);
  const state = room.holdemState;
  if (!state || room.sockets.size === 0 || state.street === 'showdown') return;

  const botAction = chooseHoldemBotAction(state);
  if (!botAction) return;

  room.botTimer = setTimeout(() => {
    room.botTimer = null;
    if (!room.holdemState || room.sockets.size === 0) return;
    const prev = room.holdemState;
    const nextAction = chooseHoldemBotAction(prev);
    if (!nextAction) return;
    room.holdemState = applyHoldemAction(prev, nextAction);
    broadcastHoldemState(room);
    void syncHoldemShowdownChips(room, prev, room.holdemState);
    scheduleHoldemBotTurnIfNeeded(room);
  }, BOT_DELAY_MS);
}

function broadcastHoldemState(room: Room): void {
  if (!room.holdemState) return;
  for (const [playerId, ws] of room.sockets) {
    const sanitized = sanitizeHoldemStateForPlayer(room.holdemState, playerId);
    send(ws, { type: 'HOLDEM_STATE', state: sanitized });
  }
}

function broadcastGameState(room: Room): void {
  if (!room.gameState) return;
  for (const [playerId, ws] of room.sockets) {
    const sanitized = sanitizeStateForPlayer(room.gameState, playerId);
    send(ws, { type: 'GAME_STATE', state: sanitized });
  }
}

const PORT = Number(process.env.PORT) || 8080;
const DIST_DIR = resolve(process.cwd(), 'dist');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const httpServer = createServer((req, res) => {
  const reqPath = (req.url || '/').split('?')[0];

  if (reqPath === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'dvorovyi-bridge-ws', rooms: rooms.size }));
    return;
  }

  if (existsSync(DIST_DIR)) {
    const safeRel = reqPath === '/' ? 'index.html' : reqPath.replace(/^\/+/, '');
    const filePath = join(DIST_DIR, safeRel);
    if (filePath.startsWith(DIST_DIR) && existsSync(filePath) && statSync(filePath).isFile()) {
      const ext = extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(readFileSync(filePath));
      return;
    }
    const indexHtml = join(DIST_DIR, 'index.html');
    if (existsSync(indexHtml)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(readFileSync(indexHtml));
      return;
    }
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, service: 'dvorovyi-bridge-ws', rooms: rooms.size }));
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString()) as ClientMessage;
    } catch {
      send(ws, { type: 'ERROR', message: 'Невірний формат повідомлення.' });
      return;
    }

    switch (msg.type) {
      case 'CREATE_ROOM': {
        const code = generateRoomCode();
        const player: RoomPlayerInfo = {
          id: msg.playerId,
          name: msg.playerName.trim() || 'Гравець 1',
          isHost: true,
          connected: true,
          avatarUrl: msg.avatarUrl,
        };
        const room: Room = {
          code,
          gameType: msg.gameType ?? 'bridge',
          durakMode: msg.durakMode ?? 'podkidnoy',
          isPublic: msg.isPublic ?? true,
          password: msg.password?.trim() || undefined,
          players: [player],
          sockets: new Map([[msg.playerId, ws]]),
          gameState: null,
          durakState: null,
          holdemState: null,
          holdemStartingChips: {},
          botTimer: null,
        };
        rooms.set(code, room);
        socketToPlayer.set(ws, { code, playerId: msg.playerId });
        broadcastRoom(room);
        break;
      }

      case 'SET_ROOM_GAME': {
        const room = rooms.get(msg.code);
        if (!room || room.gameState || room.durakState || room.holdemState) return;
        const host = room.players.find((p) => p.id === msg.playerId && p.isHost);
        if (!host) return;
        room.gameType = msg.gameType;
        if (msg.durakMode) room.durakMode = msg.durakMode;
        broadcastRoom(room);
        break;
      }

      case 'JOIN_ROOM': {
        const code = msg.code.trim().toUpperCase();
        const room = rooms.get(code);
        if (!room) {
          send(ws, { type: 'ERROR', message: `Кімнату ${code} не знайдено.` });
          return;
        }

        const existing = room.players.find((p) => p.id === msg.playerId);
        if (existing) {
          existing.connected = true;
          existing.name = msg.playerName.trim() || existing.name;
          room.sockets.set(msg.playerId, ws);
          socketToPlayer.set(ws, { code, playerId: msg.playerId });
          if (room.gameState) {
            room.gameState = {
              ...room.gameState,
              players: room.gameState.players.map((p) =>
                p.id === msg.playerId ? { ...p, connected: true } : p,
              ),
            };
            broadcastGameState(room);
          }
          if (room.durakState) {
            room.durakState = {
              ...room.durakState,
              players: room.durakState.players.map((p) =>
                p.id === msg.playerId ? { ...p, connected: true } : p,
              ),
            };
            broadcastDurakState(room);
          }
          if (room.holdemState) {
            room.holdemState = {
              ...room.holdemState,
              players: room.holdemState.players.map((p) =>
                p.id === msg.playerId ? { ...p, connected: true } : p,
              ),
            };
            broadcastHoldemState(room);
          }
          broadcastRoom(room);
          return;
        }

        if (room.durakState || room.holdemState) {
          send(ws, { type: 'ERROR', message: 'Партія вже триває — зачекайте наступну.' });
          return;
        }

        if (room.players.length >= 6) {
          send(ws, { type: 'ERROR', message: 'Кімната вже заповнена (максимум 6 гравців).' });
          return;
        }

        if (room.password && msg.password?.trim() !== room.password) {
          send(ws, { type: 'ERROR', message: 'Невірний пароль кімнати!' });
          return;
        }

        const player: RoomPlayerInfo = {
          id: msg.playerId,
          name: msg.playerName.trim() || `Гравець ${room.players.length + 1}`,
          isHost: false,
          connected: true,
          avatarUrl: msg.avatarUrl,
        };
        room.players.push(player);
        room.sockets.set(msg.playerId, ws);
        socketToPlayer.set(ws, { code, playerId: msg.playerId });

        if (room.gameState) {
          const waiting = room.gameState.waitingPlayers ?? [];
          room.gameState = {
            ...room.gameState,
            waitingPlayers: [...waiting, { id: player.id, name: player.name }],
            logs: [
              ...room.gameState.logs,
              {
                id: `${Date.now()}_join`,
                text: `${player.name} приєднався до столу (зіграє з наступного раунду).`,
                type: 'info' as const,
                timestamp: Date.now(),
              },
            ].slice(-20),
          };
          broadcastRoom(room);
          broadcastGameState(room);
          return;
        }

        broadcastRoom(room);
        break;
      }

      case 'ADD_BOT': {
        const room = rooms.get(msg.code);
        if (!room || room.gameState || room.durakState || room.holdemState) return;
        const host = room.players.find((p) => p.id === msg.playerId && p.isHost);
        if (!host) return;
        if (room.players.length >= 6) {
          send(ws, { type: 'ERROR', message: 'Максимум 6 гравців у кімнаті.' });
          return;
        }
        const botNum = room.players.filter((p) => p.isBot).length + 1;
        room.players.push({
          id: `bot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: `Бот ${botNum}`,
          isHost: false,
          isBot: true,
          connected: true,
        });
        broadcastRoom(room);
        break;
      }

      case 'REMOVE_BOT': {
        const room = rooms.get(msg.code);
        if (!room || room.gameState || room.durakState || room.holdemState) return;
        const host = room.players.find((p) => p.id === msg.playerId && p.isHost);
        if (!host) return;
        room.players = room.players.filter((p) => !(p.id === msg.botId && p.isBot));
        broadcastRoom(room);
        break;
      }

      case 'START_GAME': {
        const room = rooms.get(msg.code);
        if (!room) return;
        const host = room.players.find((p) => p.id === msg.playerId && p.isHost);
        if (!host) {
          send(ws, { type: 'ERROR', message: 'Лише хост може почати гру.' });
          return;
        }
        if (room.players.length < 2) {
          send(ws, { type: 'ERROR', message: 'Потрібно мінімум 2 гравці.' });
          return;
        }
        if (room.gameType === 'durak') {
          room.durakState = createDurakMatch(room.players, room.durakMode);
          broadcastRoom(room);
          broadcastDurakState(room);
          scheduleDurakBotTurnIfNeeded(room);
        } else if (room.gameType === 'holdem') {
          void Promise.all(
            room.players.map(async (p) => {
              if (p.isBot) return { ...p, chips: 1000 };
              const w = await getOrCreateWallet(p.id, p.name);
              return { ...p, chips: w.chips };
            }),
          ).then((playersWithChips) => {
            room.holdemStartingChips = {};
            for (const p of playersWithChips) {
              if (!p.isBot) room.holdemStartingChips[p.id] = p.chips;
            }
            room.holdemState = createHoldemMatch(playersWithChips);
            broadcastRoom(room);
            broadcastHoldemState(room);
            scheduleHoldemBotTurnIfNeeded(room);
          });
        } else {
          room.gameState = createMatch(room.players);
          broadcastRoom(room);
          broadcastGameState(room);
          scheduleBotTurnIfNeeded(room);
        }
        break;
      }

      case 'GAME_ACTION': {
        const room = rooms.get(msg.code);
        if (!room || !room.gameState) return;
        const prev = room.gameState;
        const nextState = applyAction(prev, msg.action);
        room.gameState = nextState;
        broadcastGameState(room);
        void rewardBridgeTransition(room, prev, nextState);
        scheduleBotTurnIfNeeded(room);
        break;
      }

      case 'DURAK_ACTION': {
        const room = rooms.get(msg.code);
        if (!room || !room.durakState) return;
        const prev = room.durakState;
        const nextState = applyDurakAction(prev, msg.action);
        room.durakState = nextState;
        broadcastDurakState(room);
        void rewardDurakTransition(room, prev, nextState);
        scheduleDurakBotTurnIfNeeded(room);
        break;
      }

      case 'HOLDEM_ACTION': {
        const room = rooms.get(msg.code);
        if (!room || !room.holdemState) return;
        const prev = room.holdemState;
        const nextState = applyHoldemAction(prev, msg.action);
        room.holdemState = nextState;
        broadcastHoldemState(room);
        void syncHoldemShowdownChips(room, prev, nextState);
        scheduleHoldemBotTurnIfNeeded(room);
        break;
      }

      case 'GET_WALLET': {
        socketPlayerIds.set(ws, msg.playerId);
        registerPlayerName(msg.playerId, msg.playerName);
        pushFriendsStateTo(msg.playerId);
        send(ws, { type: 'PUBLIC_ROOMS', rooms: getPublicRoomsList() });
        void getOrCreateWallet(msg.playerId, msg.playerName).then((wallet) => {
          send(ws, {
            type: 'WALLET_UPDATE',
            wallet: { ...wallet, isAdmin: isAdminPlayer(msg.playerId) },
          });
        });
        break;
      }

      case 'GET_PUBLIC_ROOMS': {
        send(ws, { type: 'PUBLIC_ROOMS', rooms: getPublicRoomsList() });
        break;
      }

      case 'SPIN_SLOT':
      case 'BUY_SLOT_BONUS': {
        const buyBonus = msg.type === 'BUY_SLOT_BONUS';
        void executeSlotSpin(msg.playerId, msg.playerName, msg.bet, buyBonus).then((res) => {
          if (!res.ok) {
            send(ws, { type: 'ERROR', message: res.error });
            return;
          }
          send(ws, { type: 'SLOT_RESULT', result: res.result });
          void getOrCreateWallet(msg.playerId, msg.playerName).then((w) => {
            send(ws, {
              type: 'WALLET_UPDATE',
              wallet: { ...w, isAdmin: isAdminPlayer(msg.playerId) },
            });
          });
        });
        break;
      }

      case 'GET_FRIENDS': {
        pushFriendsStateTo(msg.playerId);
        break;
      }

      case 'SEND_FRIEND_REQUEST': {
        const res = sendFriendRequest(msg.fromId, msg.fromName, msg.targetId);
        if (!res.ok) {
          send(ws, { type: 'ERROR', message: res.error || 'Не вдалося надіслати запит.' });
        } else {
          pushFriendsStateTo(res.targetId);
          pushFriendsStateTo(msg.fromId);
        }
        break;
      }

      case 'RESPOND_FRIEND_REQUEST': {
        respondFriendRequest(msg.playerId, msg.fromId, msg.accept);
        pushFriendsStateTo(msg.playerId);
        pushFriendsStateTo(msg.fromId);
        break;
      }

      case 'INVITE_FRIEND_TO_ROOM': {
        const room = rooms.get(msg.code);
        if (!room) return;
        for (const [clientWs, pid] of socketPlayerIds.entries()) {
          if (pid === msg.friendId) {
            send(clientWs, {
              type: 'ROOM_INVITE',
              invite: {
                code: room.code,
                fromName: msg.fromName,
                gameType: room.gameType,
              },
            });
          }
        }
        break;
      }

      case 'CLAIM_BONUS': {
        void claimRescueBonus(msg.playerId, msg.playerName).then(({ profile }) => {
          send(ws, {
            type: 'WALLET_UPDATE',
            wallet: { ...profile, isAdmin: isAdminPlayer(msg.playerId) },
          });
        });
        break;
      }

      case 'GET_LEADERBOARD': {
        void getLeaderboard(10).then((entries) => {
          send(ws, { type: 'LEADERBOARD', entries });
        });
        break;
      }

      case 'ADMIN_GET_WALLETS': {
        if (!isAdminPlayer(msg.adminPlayerId)) return;
        void getLeaderboard(50).then((entries) => {
          send(ws, { type: 'ADMIN_WALLETS', entries });
        });
        break;
      }

      case 'ADMIN_ADJUST_CHIPS': {
        if (!isAdminPlayer(msg.adminPlayerId)) return;
        const targetId = normalizeTargetPlayerId(msg.targetId);
        if (!targetId || !Number.isFinite(msg.delta)) return;
        void addChips(targetId, '', Math.trunc(msg.delta), false).then((updated) => {
          // Push live wallet update to target if they are online
          for (const [clientWs, pid] of socketPlayerIds.entries()) {
            if (pid === targetId) {
              send(clientWs, {
                type: 'WALLET_UPDATE',
                wallet: { ...updated, isAdmin: isAdminPlayer(pid) },
              });
            }
          }
          void getLeaderboard(50).then((entries) => {
            send(ws, { type: 'ADMIN_WALLETS', entries });
          });
        });
        break;
      }

      case 'LEAVE_ROOM': {
        handleDisconnect(ws, true);
        break;
      }
    }
  });

  ws.on('close', () => {
    socketPlayerIds.delete(ws);
    handleDisconnect(ws, false);
  });
});

function handleDisconnect(ws: WebSocket, explicitLeave: boolean): void {
  const meta = socketToPlayer.get(ws);
  if (!meta) return;
  socketToPlayer.delete(ws);

  const room = rooms.get(meta.code);
  if (!room) return;

  room.sockets.delete(meta.playerId);

  if (explicitLeave && !room.gameState) {
    room.players = room.players.filter((p) => p.id !== meta.playerId);
    if (room.players.length > 0 && !room.players.some((p) => p.isHost)) {
      room.players[0].isHost = true;
    }
  } else {
    const p = room.players.find((pl) => pl.id === meta.playerId);
    if (p) p.connected = false;
    if (room.gameState) {
      room.gameState = {
        ...room.gameState,
        players: room.gameState.players.map((pl) =>
          pl.id === meta.playerId ? { ...pl, connected: false } : pl,
        ),
      };
      broadcastGameState(room);
    }
  }

  if (room.sockets.size === 0) {
    clearBotTimer(room);
    if (!room.gameState) {
      rooms.delete(meta.code);
    }
  } else {
    broadcastRoom(room);
  }
}

httpServer.listen(PORT, () => {
  console.log(`Dvorovyi Bridge WS server listening on http://localhost:${PORT}`);
});
