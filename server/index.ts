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
  getKnownPlayerName,
  registerPlayerName,
  respondFriendRequest,
  sendFriendRequest,
} from './friends';
import { executeSlotSpin } from './slot';
import { actBlackjack, calculateBlackjackScore, dealBlackjack } from './blackjack';
import {
  applyMultiBlackjackAction,
  createMultiBlackjackSession,
  sanitizeMultiBlackjackState,
  type MultiBlackjackSession,
} from './multiBlackjack';
import {
  addChips,
  claimDailyBonus,
  claimRescueBonus,
  getLeaderboard,
  getNextDailyAt,
  getOrCreateWallet,
  isAdminPlayer,
  normalizeTargetPlayerId,
} from './wallet';
import type {
  AdminOnlinePlayer,
  AdminRoomInfo,
  BridgeMode,
  ChatMessage,
  ClientMessage,
  DurakMode,
  DurakState,
  GameState,
  GameType,
  HoldemState,
  PublicRoomSummary,
  RoomInfo,
  RoomPlayerInfo,
  ServerConfig,
  ServerMessage,
} from '../src/shared/types';

interface Room {
  code: string;
  gameType: GameType;
  bridgeMode: BridgeMode;
  durakMode: DurakMode;
  isPublic: boolean;
  password?: string;
  players: RoomPlayerInfo[];
  sockets: Map<string, WebSocket>;
  gameState: GameState | null;
  durakState: DurakState | null;
  holdemState: HoldemState | null;
  multiBlackjack: MultiBlackjackSession | null;
  holdemStartingChips: Record<string, number>;
  botTimer: ReturnType<typeof setTimeout> | null;
  turnTimer: ReturnType<typeof setTimeout> | null;
}

const BOT_DELAY_MS = 1200;
const PUBLIC_TURN_TIMEOUT_MS = 60000;

const serverConfig: ServerConfig = {
  slotEnabled: true,
  bridgeEnabled: true,
  durakEnabled: true,
  holdemEnabled: true,
  blackjackEnabled: true,
  trainingEnabled: true,
  karasykBrandingEnabled: true,
  eightSplitEnabled: true,
  bridgeRoundReward: 50,
  durakWinReward: 100,
  holdemBigBlind: 20,
};

const bannedPlayerIds = new Set<string>();
const friendChats = new Map<string, ChatMessage[]>();
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

function getRoomMaxPlayers(gameType: GameType): number {
  return gameType === 'blackjack' ? 4 : 6;
}

function getPublicRoomsList(): PublicRoomSummary[] {
  const list: PublicRoomSummary[] = [];
  for (const room of rooms.values()) {
    if (!room.isPublic) continue;
    const maxPlayers = getRoomMaxPlayers(room.gameType);
    if (room.players.length >= maxPlayers) continue;
    const host = room.players.find((p) => p.isHost) ?? room.players[0];
    list.push({
      code: room.code,
      gameType: room.gameType,
      bridgeMode: room.bridgeMode,
      durakMode: room.durakMode,
      hostName: host?.name || 'Хост',
      playerCount: room.players.length,
      maxPlayers,
      hasPassword: Boolean(room.password),
      started:
        room.gameState !== null ||
        room.durakState !== null ||
        room.holdemState !== null ||
        room.multiBlackjack !== null,
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
    bridgeMode: room.bridgeMode,
    durakMode: room.durakMode,
    isPublic: room.isPublic,
    hasPassword: Boolean(room.password),
    players: room.players,
    started:
      room.gameState !== null ||
      room.durakState !== null ||
      room.holdemState !== null ||
      room.multiBlackjack !== null,
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
  void getFriendsState(playerId, online).then((fState) => {
    for (const [clientWs, pid] of socketPlayerIds.entries()) {
      if (pid === playerId) {
        send(clientWs, {
          type: 'FRIENDS_STATE',
          friends: fState.friends,
          incomingRequests: fState.incomingRequests,
        });
      }
    }
  });
}

function clearBotTimer(room: Room): void {
  if (room.botTimer) {
    clearTimeout(room.botTimer);
    room.botTimer = null;
  }
  if (room.turnTimer) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
  }
}

function schedulePublicTurnTimeout(room: Room): void {
  if (room.turnTimer) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
  }
  if (!room.isPublic || room.sockets.size === 0) return;

  if (room.gameState) {
    const st = room.gameState;
    if (
      st.phase !== 'playing' &&
      st.phase !== 'must_cover_six' &&
      st.phase !== 'choosing_suit' &&
      st.phase !== 'queen_spades_choice' &&
      st.phase !== 'eight_split_choice' &&
      st.phase !== 'bridge_choice'
    ) {
      return;
    }
    const active = st.players[st.currentPlayerIndex];
    if (!active || active.isBot) return;

    room.turnTimer = setTimeout(() => {
      room.turnTimer = null;
      if (!room.gameState) return;
      const cur = room.gameState;
      const curP = cur.players[cur.currentPlayerIndex];
      if (!curP || curP.isBot) return;
      const prev = cur;
      if (cur.phase === 'bridge_choice') {
        room.gameState = applyAction(cur, { type: 'DECLINE_BRIDGE', playerId: curP.id });
      } else if (cur.phase === 'choosing_suit') {
        room.gameState = applyAction(cur, { type: 'CHOOSE_SUIT', playerId: curP.id, suit: 'spades' });
      } else if (cur.phase === 'queen_spades_choice') {
        room.gameState = applyAction(cur, {
          type: 'CHOOSE_QUEEN_SPADES',
          playerId: curP.id,
          option: 'take5_skip',
        });
      } else if (cur.phase === 'eight_split_choice') {
        room.gameState = applyAction(cur, {
          type: 'CHOOSE_EIGHT_SPLIT',
          playerId: curP.id,
          mode: 'all_next',
        });
      } else if (cur.phase === 'playing' && cur.hasDrawnThisTurn) {
        room.gameState = applyAction(cur, { type: 'PASS_TURN', playerId: curP.id });
      } else {
        room.gameState = applyAction(cur, { type: 'DRAW_CARD', playerId: curP.id });
      }
      broadcastGameState(room);
      void rewardBridgeTransition(room, prev, room.gameState);
      scheduleBotTurnIfNeeded(room);
      schedulePublicTurnTimeout(room);
    }, PUBLIC_TURN_TIMEOUT_MS);
    return;
  }

  if (room.holdemState && room.holdemState.street !== 'showdown') {
    const st = room.holdemState;
    const active = st.players[st.currentPlayerIndex];
    if (!active || active.isBot) return;

    room.turnTimer = setTimeout(() => {
      room.turnTimer = null;
      if (!room.holdemState || room.holdemState.street === 'showdown') return;
      const prev = room.holdemState;
      const curP = prev.players[prev.currentPlayerIndex];
      if (!curP || curP.isBot) return;
      const toCall = Math.max(0, prev.currentMaxBet - curP.currentBet);
      room.holdemState = applyHoldemAction(
        prev,
        toCall === 0
          ? { type: 'HOLDEM_CHECK_CALL', playerId: curP.id }
          : { type: 'HOLDEM_FOLD', playerId: curP.id },
      );
      broadcastHoldemState(room);
      void syncHoldemShowdownChips(room, prev, room.holdemState);
      scheduleHoldemBotTurnIfNeeded(room);
      schedulePublicTurnTimeout(room);
    }, PUBLIC_TURN_TIMEOUT_MS);
    return;
  }

  if (room.durakState && room.durakState.phase === 'playing') {
    const st = room.durakState;
    const def = st.players[st.defenderIndex];
    if (def && !def.isBot && !st.defenderTaking && st.table.some((p) => p.defense === null)) {
      room.turnTimer = setTimeout(() => {
        room.turnTimer = null;
        if (!room.durakState || room.durakState.phase !== 'playing') return;
        const prev = room.durakState;
        const curDef = prev.players[prev.defenderIndex];
        if (!curDef || curDef.isBot) return;
        room.durakState = applyDurakAction(prev, { type: 'TAKE_CARDS', playerId: curDef.id });
        broadcastDurakState(room);
        void rewardDurakTransition(room, prev, room.durakState);
        scheduleDurakBotTurnIfNeeded(room);
        schedulePublicTurnTimeout(room);
      }, PUBLIC_TURN_TIMEOUT_MS);
    }
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
    state.phase !== 'queen_spades_choice' &&
    state.phase !== 'eight_split_choice' &&
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
    const base = serverConfig.bridgeRoundReward;
    const bonus = nextState.roundWinReason === 'bridge' ? base * 2 : base;
    const w = await addChips(winner.id, winner.name, bonus, false);
    const ws = room.sockets.get(winner.id);
    if (ws) send(ws, { type: 'WALLET_UPDATE', wallet: { ...w, isAdmin: isAdminPlayer(winner.id) } });
  }

  if (nextState.phase === 'match_over') {
    const champion = nextState.players.find((p) => !p.eliminated);
    if (champion) {
      const w = await addChips(champion.id, champion.name, serverConfig.bridgeRoundReward * 4, true);
      const ws = room.sockets.get(champion.id);
      if (ws) send(ws, { type: 'WALLET_UPDATE', wallet: { ...w, isAdmin: isAdminPlayer(champion.id) } });
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
        const w = await addChips(p.id, p.name, serverConfig.durakWinReward, true);
        const ws = room.sockets.get(p.id);
        if (ws) send(ws, { type: 'WALLET_UPDATE', wallet: { ...w, isAdmin: isAdminPlayer(p.id) } });
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

function broadcastMultiBlackjackState(room: Room): void {
  if (!room.multiBlackjack) return;
  const sanitized = sanitizeMultiBlackjackState(room.multiBlackjack.state);
  for (const [, ws] of room.sockets) {
    send(ws, { type: 'MULTI_BJ_STATE', state: sanitized });
  }
}

async function syncMultiBlackjackWallets(room: Room): Promise<void> {
  if (!room.multiBlackjack) return;
  for (const p of room.multiBlackjack.state.players) {
    if (p.isBot) continue;
    const ws = room.sockets.get(p.id);
    if (!ws) continue;
    const w = await getOrCreateWallet(p.id, p.name);
    send(ws, {
      type: 'WALLET_UPDATE',
      wallet: {
        playerId: w.playerId,
        name: w.name,
        chips: w.chips,
        wins: w.wins,
        isAdmin: isAdminPlayer(w.playerId),
        nextDailyAt: getNextDailyAt(w.playerId),
      },
    });
  }
}

function scheduleMultiBlackjackBotTurnIfNeeded(room: Room): void {
  clearBotTimer(room);
  const session = room.multiBlackjack;
  if (!session || session.state.phase !== 'playing' || room.sockets.size === 0) return;
  const cur = session.state.players[session.state.currentPlayerIndex];
  if (!cur || !cur.isBot || cur.status !== 'playing') return;

  room.botTimer = setTimeout(() => {
    room.botTimer = null;
    if (!room.multiBlackjack || room.multiBlackjack.state.phase !== 'playing' || room.sockets.size === 0) return;
    const active = room.multiBlackjack.state.players[room.multiBlackjack.state.currentPlayerIndex];
    if (!active || !active.isBot || active.status !== 'playing') return;
    const score = calculateBlackjackScore(active.hand);
    const actionType = score < 17 ? 'BJ_HIT' : 'BJ_STAND';
    void applyMultiBlackjackAction(room.multiBlackjack, { type: actionType, playerId: active.id }).then(() => {
      broadcastMultiBlackjackState(room);
      void syncMultiBlackjackWallets(room);
      scheduleMultiBlackjackBotTurnIfNeeded(room);
    });
  }, BOT_DELAY_MS);
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
const BOT_TOKEN = process.env.BOT_TOKEN?.trim();
const PUBLIC_URL =
  process.env.APP_URL?.replace(/\/+$/, '') ||
  (process.env.RENDER_EXTERNAL_HOSTNAME
    ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`
    : 'https://dvorovyi-bridge.onrender.com');

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

  if (reqPath === '/tg-webhook' && req.method === 'POST' && BOT_TOKEN) {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      try {
        const update = JSON.parse(body) as {
          message?: { chat?: { id?: number }; text?: string };
        };
        const chatId = update.message?.chat?.id;
        const text = update.message?.text || '';
        if (chatId && text.startsWith('/start')) {
          void fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: 'Привіт! 🃏 Натисни кнопку нижче, щоб відкрити «Карасьовий Брідж» (Брідж, Дурак, Покер та Слот):',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🎮 Грати зараз', web_app: { url: PUBLIC_URL } }],
                ],
              },
            }),
          });
        }
      } catch {
        // Ignore malformed webhook payload
      }
    });
    return;
  }

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

function getAdminRoomsList(): AdminRoomInfo[] {
  const list: AdminRoomInfo[] = [];
  for (const room of rooms.values()) {
    list.push({
      code: room.code,
      gameType: room.gameType,
      isPublic: room.isPublic,
      hasPassword: Boolean(room.password),
      started:
        room.gameState !== null ||
        room.durakState !== null ||
        room.holdemState !== null ||
        room.multiBlackjack !== null,
      players: room.players,
    });
  }
  return list;
}

function sendAdminTelegramWallets(ws: WebSocket): void {
  void getLeaderboard(200).then((entries) => {
    const tgEntries = entries
      .filter((e) => e.playerId.startsWith('tg_'))
      .map((e) => ({
        ...e,
        banned: bannedPlayerIds.has(e.playerId),
      }));
    send(ws, { type: 'ADMIN_WALLETS', entries: tgEntries });
  });
}

function getAdminOnlinePlayers(): AdminOnlinePlayer[] {
  const uniqueIds = Array.from(getOnlinePlayerIds());
  return uniqueIds.map((pid) => ({
    playerId: pid,
    name: getKnownPlayerName(pid),
    banned: bannedPlayerIds.has(pid),
  }));
}

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
        if (bannedPlayerIds.has(msg.playerId)) {
          send(ws, { type: 'ERROR', message: 'Ваш акаунт заблоковано адміністратором.' });
          return;
        }
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
          bridgeMode: msg.bridgeMode ?? 'kalynivskyi',
          durakMode: msg.durakMode ?? 'podkidnoy',
          isPublic: msg.isPublic ?? true,
          password: msg.password?.trim() || undefined,
          players: [player],
          sockets: new Map([[msg.playerId, ws]]),
          gameState: null,
          durakState: null,
          holdemState: null,
          multiBlackjack: null,
          holdemStartingChips: {},
          botTimer: null,
          turnTimer: null,
        };
        rooms.set(code, room);
        socketToPlayer.set(ws, { code, playerId: msg.playerId });
        if (msg.autoStart && room.gameType === 'blackjack') {
          void createMultiBlackjackSession(room.players).then((session) => {
            room.multiBlackjack = session;
            broadcastRoom(room);
            broadcastMultiBlackjackState(room);
            void syncMultiBlackjackWallets(room);
          });
        } else {
          broadcastRoom(room);
        }
        break;
      }

      case 'SET_ROOM_GAME': {
        const room = rooms.get(msg.code);
        if (!room || room.gameState || room.durakState || room.holdemState || room.multiBlackjack) return;
        const host = room.players.find((p) => p.id === msg.playerId && p.isHost);
        if (!host) return;
        if (msg.gameType === 'blackjack' && room.players.length > 4) {
          send(ws, { type: 'ERROR', message: 'У Блекджек можна грати максимум вчотирьох (зараз >4 гравців).' });
          return;
        }
        room.gameType = msg.gameType;
        if (msg.bridgeMode) room.bridgeMode = msg.bridgeMode;
        if (msg.durakMode) room.durakMode = msg.durakMode;
        broadcastRoom(room);
        break;
      }

      case 'JOIN_ROOM': {
        if (bannedPlayerIds.has(msg.playerId)) {
          send(ws, { type: 'ERROR', message: 'Ваш акаунт заблоковано адміністратором.' });
          return;
        }
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
          if (room.multiBlackjack) {
            room.multiBlackjack.state = {
              ...room.multiBlackjack.state,
              players: room.multiBlackjack.state.players.map((p) =>
                p.id === msg.playerId ? { ...p, connected: true } : p,
              ),
            };
            broadcastMultiBlackjackState(room);
          }
          broadcastRoom(room);
          return;
        }

        if (room.durakState || room.holdemState || room.multiBlackjack) {
          send(ws, { type: 'ERROR', message: 'Партія вже триває — зачекайте наступну.' });
          return;
        }

        const maxPlayers = getRoomMaxPlayers(room.gameType);
        if (room.players.length >= maxPlayers) {
          send(ws, { type: 'ERROR', message: `Кімната вже заповнена (максимум ${maxPlayers} гравців).` });
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
        if (!room || room.gameState || room.durakState || room.holdemState || room.multiBlackjack) return;
        const host = room.players.find((p) => p.id === msg.playerId && p.isHost);
        if (!host) return;
        const maxPlayers = getRoomMaxPlayers(room.gameType);
        if (room.players.length >= maxPlayers) {
          send(ws, { type: 'ERROR', message: `Максимум ${maxPlayers} гравців у кімнаті.` });
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
        if (!room || room.gameState || room.durakState || room.holdemState || room.multiBlackjack) return;
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
        const minPlayers = room.gameType === 'blackjack' ? 1 : 2;
        if (room.players.length < minPlayers) {
          send(ws, { type: 'ERROR', message: `Потрібно мінімум ${minPlayers} гравці.` });
          return;
        }
        if (room.gameType === 'blackjack') {
          void createMultiBlackjackSession(room.players).then((session) => {
            room.multiBlackjack = session;
            broadcastRoom(room);
            broadcastMultiBlackjackState(room);
            void syncMultiBlackjackWallets(room);
            scheduleMultiBlackjackBotTurnIfNeeded(room);
          });
        } else if (room.gameType === 'durak') {
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
            room.holdemState.bigBlind = serverConfig.holdemBigBlind;
            room.holdemState.smallBlind = Math.max(5, Math.floor(serverConfig.holdemBigBlind / 2));
            broadcastRoom(room);
            broadcastHoldemState(room);
            scheduleHoldemBotTurnIfNeeded(room);
            schedulePublicTurnTimeout(room);
          });
        } else {
          room.gameState = createMatch(
            room.players,
            room.bridgeMode,
            Math.random,
            serverConfig.eightSplitEnabled,
          );
          broadcastRoom(room);
          broadcastGameState(room);
          scheduleBotTurnIfNeeded(room);
          schedulePublicTurnTimeout(room);
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
        schedulePublicTurnTimeout(room);
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
        schedulePublicTurnTimeout(room);
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
        schedulePublicTurnTimeout(room);
        break;
      }

      case 'MULTI_BJ_ACTION': {
        const room = rooms.get(msg.code);
        if (!room || !room.multiBlackjack) return;
        void applyMultiBlackjackAction(room.multiBlackjack, msg.action).then((res) => {
          if (res.error) {
            send(ws, { type: 'ERROR', message: res.error });
            return;
          }
          broadcastMultiBlackjackState(room);
          void syncMultiBlackjackWallets(room);
          scheduleMultiBlackjackBotTurnIfNeeded(room);
        });
        break;
      }

      case 'GET_WALLET': {
        socketPlayerIds.set(ws, msg.playerId);
        registerPlayerName(msg.playerId, msg.playerName);
        pushFriendsStateTo(msg.playerId);
        send(ws, { type: 'PUBLIC_ROOMS', rooms: getPublicRoomsList() });
        send(ws, { type: 'SERVER_CONFIG', config: serverConfig });
        void getOrCreateWallet(msg.playerId, msg.playerName).then((wallet) => {
          send(ws, {
            type: 'WALLET_UPDATE',
            wallet: {
              ...wallet,
              isAdmin: isAdminPlayer(msg.playerId),
              nextDailyAt: getNextDailyAt(msg.playerId),
            },
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
        if (bannedPlayerIds.has(msg.playerId)) {
          send(ws, { type: 'ERROR', message: 'Ваш акаунт заблоковано адміністратором.' });
          return;
        }
        if (!serverConfig.slotEnabled) {
          send(ws, { type: 'ERROR', message: 'Слот тимчасово вимкнено адміністратором.' });
          return;
        }
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

      case 'BJ_DEAL': {
        if (bannedPlayerIds.has(msg.playerId)) {
          send(ws, { type: 'ERROR', message: 'Ваш акаунт заблоковано адміністратором.' });
          return;
        }
        if (!serverConfig.blackjackEnabled) {
          send(ws, { type: 'ERROR', message: 'Блекджек тимчасово вимкнено.' });
          return;
        }
        void dealBlackjack(msg.playerId, msg.playerName, msg.bet).then((res) => {
          if (!res.ok) {
            send(ws, { type: 'ERROR', message: res.error });
            return;
          }
          send(ws, { type: 'BJ_STATE', state: res.state });
          void getOrCreateWallet(msg.playerId, msg.playerName).then((w) => {
            send(ws, {
              type: 'WALLET_UPDATE',
              wallet: {
                ...w,
                isAdmin: isAdminPlayer(msg.playerId),
                nextDailyAt: getNextDailyAt(msg.playerId),
              },
            });
          });
        });
        break;
      }

      case 'BJ_ACTION': {
        void actBlackjack(msg.playerId, msg.playerName, msg.action).then((res) => {
          if (!res.ok) {
            send(ws, { type: 'ERROR', message: res.error });
            return;
          }
          send(ws, { type: 'BJ_STATE', state: res.state });
          void getOrCreateWallet(msg.playerId, msg.playerName).then((w) => {
            send(ws, {
              type: 'WALLET_UPDATE',
              wallet: {
                ...w,
                isAdmin: isAdminPlayer(msg.playerId),
                nextDailyAt: getNextDailyAt(msg.playerId),
              },
            });
          });
        });
        break;
      }

      case 'SEND_ROOM_CHAT': {
        const room = rooms.get(msg.code);
        if (!room) return;
        const clean = msg.text.trim().slice(0, 250);
        if (!clean) return;
        const chatMsg: ChatMessage = {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          senderId: msg.playerId,
          senderName: msg.playerName,
          text: clean,
          timestamp: Date.now(),
        };
        for (const [, clientWs] of room.sockets) {
          send(clientWs, { type: 'ROOM_CHAT_MSG', message: chatMsg });
        }
        break;
      }

      case 'GET_FRIEND_CHAT': {
        const key = [msg.playerId, msg.friendId].sort().join('__');
        send(ws, {
          type: 'FRIEND_CHAT_HISTORY',
          friendId: msg.friendId,
          messages: friendChats.get(key) ?? [],
        });
        break;
      }

      case 'SEND_FRIEND_CHAT': {
        const clean = msg.text.trim().slice(0, 250);
        if (!clean) return;
        const key = [msg.fromId, msg.toId].sort().join('__');
        const chatMsg: ChatMessage = {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          senderId: msg.fromId,
          senderName: msg.fromName,
          text: clean,
          timestamp: Date.now(),
        };
        const list = [...(friendChats.get(key) ?? []), chatMsg].slice(-50);
        friendChats.set(key, list);
        for (const [clientWs, pid] of socketPlayerIds.entries()) {
          if (pid === msg.fromId) {
            send(clientWs, { type: 'FRIEND_CHAT_MSG', friendId: msg.toId, message: chatMsg });
          } else if (pid === msg.toId) {
            send(clientWs, { type: 'FRIEND_CHAT_MSG', friendId: msg.fromId, message: chatMsg });
          }
        }
        break;
      }

      case 'GET_FRIENDS': {
        pushFriendsStateTo(msg.playerId);
        break;
      }

      case 'SEND_FRIEND_REQUEST': {
        void sendFriendRequest(msg.fromId, msg.fromName, msg.targetId).then((res) => {
          if (!res.ok) {
            send(ws, { type: 'ERROR', message: res.error || 'Не вдалося надіслати запит.' });
          } else {
            pushFriendsStateTo(res.targetId);
            pushFriendsStateTo(msg.fromId);
          }
        });
        break;
      }

      case 'RESPOND_FRIEND_REQUEST': {
        const myName = getKnownPlayerName(msg.playerId);
        void respondFriendRequest(msg.playerId, myName, msg.fromId, msg.accept).then(() => {
          pushFriendsStateTo(msg.playerId);
          pushFriendsStateTo(msg.fromId);
        });
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
            wallet: {
              ...profile,
              isAdmin: isAdminPlayer(msg.playerId),
              nextDailyAt: getNextDailyAt(msg.playerId),
            },
          });
        });
        break;
      }

      case 'CLAIM_DAILY_BONUS': {
        void claimDailyBonus(msg.playerId, msg.playerName).then((res) => {
          if (!res.ok) {
            send(ws, { type: 'ERROR', message: res.error });
            return;
          }
          send(ws, {
            type: 'DAILY_BONUS_RESULT',
            amount: res.amount,
            nextDailyAt: res.nextDailyAt,
          });
          send(ws, {
            type: 'WALLET_UPDATE',
            wallet: {
              ...res.profile,
              isAdmin: isAdminPlayer(msg.playerId),
              nextDailyAt: res.nextDailyAt,
            },
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
        const onlinePlayers = getAdminOnlinePlayers();
        send(ws, {
          type: 'ADMIN_ONLINE',
          onlineCount: onlinePlayers.length,
          players: onlinePlayers,
          config: serverConfig,
        });
        sendAdminTelegramWallets(ws);
        break;
      }

      case 'ADMIN_GIFT_ALL': {
        if (!isAdminPlayer(msg.adminPlayerId) || !Number.isFinite(msg.amount)) return;
        const amount = Math.trunc(msg.amount);
        const onlineIds = Array.from(getOnlinePlayerIds());
        void Promise.all(
          onlineIds.map(async (pid) => {
            const updated = await addChips(pid, getKnownPlayerName(pid), amount, false);
            for (const [clientWs, sPid] of socketPlayerIds.entries()) {
              if (sPid === pid) {
                send(clientWs, {
                  type: 'WALLET_UPDATE',
                  wallet: {
                    ...updated,
                    isAdmin: isAdminPlayer(pid),
                    nextDailyAt: getNextDailyAt(pid),
                  },
                });
                send(clientWs, {
                  type: 'ADMIN_NOTICE',
                  message: `🎁 Адмін роздав усім онлайн ${amount > 0 ? `+${amount}` : amount} фішок!`,
                });
              }
            }
          }),
        ).then(() => {
          sendAdminTelegramWallets(ws);
        });
        break;
      }

      case 'ADMIN_SET_BAN': {
        if (!isAdminPlayer(msg.adminPlayerId)) return;
        const targetId = normalizeTargetPlayerId(msg.targetId);
        if (msg.banned) {
          bannedPlayerIds.add(targetId);
          for (const [clientWs, pid] of socketPlayerIds.entries()) {
            if (pid === targetId) {
              send(clientWs, {
                type: 'ERROR',
                message: 'Ваш акаунт заблоковано адміністратором.',
              });
            }
          }
        } else {
          bannedPlayerIds.delete(targetId);
        }
        const onlinePlayers = getAdminOnlinePlayers();
        send(ws, {
          type: 'ADMIN_ONLINE',
          onlineCount: onlinePlayers.length,
          players: onlinePlayers,
          config: serverConfig,
        });
        sendAdminTelegramWallets(ws);
        break;
      }

      case 'ADMIN_UPDATE_CONFIG': {
        if (!isAdminPlayer(msg.adminPlayerId)) return;
        if (typeof msg.config.slotEnabled === 'boolean') {
          serverConfig.slotEnabled = msg.config.slotEnabled;
        }
        if (typeof msg.config.bridgeEnabled === 'boolean') {
          serverConfig.bridgeEnabled = msg.config.bridgeEnabled;
        }
        if (typeof msg.config.durakEnabled === 'boolean') {
          serverConfig.durakEnabled = msg.config.durakEnabled;
        }
        if (typeof msg.config.holdemEnabled === 'boolean') {
          serverConfig.holdemEnabled = msg.config.holdemEnabled;
        }
        if (typeof msg.config.blackjackEnabled === 'boolean') {
          serverConfig.blackjackEnabled = msg.config.blackjackEnabled;
        }
        if (typeof msg.config.trainingEnabled === 'boolean') {
          serverConfig.trainingEnabled = msg.config.trainingEnabled;
        }
        if (typeof msg.config.karasykBrandingEnabled === 'boolean') {
          serverConfig.karasykBrandingEnabled = msg.config.karasykBrandingEnabled;
        }
        if (typeof msg.config.eightSplitEnabled === 'boolean') {
          serverConfig.eightSplitEnabled = msg.config.eightSplitEnabled;
        }
        if (
          typeof msg.config.bridgeRoundReward === 'number' &&
          Number.isFinite(msg.config.bridgeRoundReward)
        ) {
          serverConfig.bridgeRoundReward = Math.max(0, Math.trunc(msg.config.bridgeRoundReward));
        }
        if (
          typeof msg.config.durakWinReward === 'number' &&
          Number.isFinite(msg.config.durakWinReward)
        ) {
          serverConfig.durakWinReward = Math.max(0, Math.trunc(msg.config.durakWinReward));
        }
        if (
          typeof msg.config.holdemBigBlind === 'number' &&
          Number.isFinite(msg.config.holdemBigBlind)
        ) {
          serverConfig.holdemBigBlind = Math.max(10, Math.trunc(msg.config.holdemBigBlind));
        }
        for (const clientWs of wss.clients) {
          send(clientWs, { type: 'SERVER_CONFIG', config: serverConfig });
        }
        const onlinePlayers = getAdminOnlinePlayers();
        send(ws, {
          type: 'ADMIN_ONLINE',
          onlineCount: onlinePlayers.length,
          players: onlinePlayers,
          config: serverConfig,
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

      case 'ADMIN_GET_ROOMS': {
        if (!isAdminPlayer(msg.adminPlayerId)) return;
        send(ws, { type: 'ADMIN_ROOMS', rooms: getAdminRoomsList() });
        break;
      }

      case 'ADMIN_CLOSE_ROOM': {
        if (!isAdminPlayer(msg.adminPlayerId)) return;
        const room = rooms.get(msg.code);
        if (!room) return;
        clearBotTimer(room);
        for (const [, clientWs] of room.sockets) {
          socketToPlayer.delete(clientWs);
          send(clientWs, { type: 'ROOM_CLOSED', reason: 'Кімнату закрито адміністратором.' });
        }
        rooms.delete(msg.code);
        broadcastPublicRooms();
        send(ws, { type: 'ADMIN_ROOMS', rooms: getAdminRoomsList() });
        break;
      }

      case 'ADMIN_KICK_PLAYER': {
        if (!isAdminPlayer(msg.adminPlayerId)) return;
        const room = rooms.get(msg.code);
        if (!room) return;
        const targetWs = room.sockets.get(msg.targetId);
        if (targetWs) {
          room.sockets.delete(msg.targetId);
          socketToPlayer.delete(targetWs);
          send(targetWs, { type: 'ROOM_CLOSED', reason: 'Вас видалено з кімнати адміністратором.' });
        }
        room.players = room.players.filter((p) => p.id !== msg.targetId);
        if (room.gameState) {
          room.gameState = {
            ...room.gameState,
            players: room.gameState.players.map((p) =>
              p.id === msg.targetId ? { ...p, eliminated: true, connected: false } : p,
            ),
            waitingPlayers: (room.gameState.waitingPlayers ?? []).filter(
              (w) => w.id !== msg.targetId,
            ),
          };
          broadcastGameState(room);
        }
        if (room.sockets.size === 0 || room.players.every((p) => p.isBot)) {
          clearBotTimer(room);
          rooms.delete(msg.code);
        } else {
          broadcastRoom(room);
        }
        broadcastPublicRooms();
        send(ws, { type: 'ADMIN_ROOMS', rooms: getAdminRoomsList() });
        break;
      }

      case 'ADMIN_BROADCAST': {
        if (!isAdminPlayer(msg.adminPlayerId)) return;
        const text = msg.message.trim();
        if (!text) return;
        for (const clientWs of wss.clients) {
          send(clientWs, { type: 'ADMIN_NOTICE', message: text });
        }
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

  const hasGame = Boolean(room.gameState || room.durakState || room.holdemState || room.multiBlackjack);

  if (explicitLeave && !hasGame) {
    room.players = room.players.filter((p) => p.id !== meta.playerId);
    const nextHuman = room.players.find((p) => !p.isBot);
    if (nextHuman && !room.players.some((p) => p.isHost)) {
      nextHuman.isHost = true;
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

  const remainingHumansCount = room.players.filter((p) => !p.isBot).length;
  // Close room immediately if no live humans are connected and only bots/1 human remain
  if (room.sockets.size === 0 && (explicitLeave || !hasGame || remainingHumansCount <= 1)) {
    clearBotTimer(room);
    rooms.delete(meta.code);
    broadcastPublicRooms();
    return;
  }

  if (room.sockets.size === 0) {
    clearBotTimer(room);
  } else {
    broadcastRoom(room);
  }
  broadcastPublicRooms();
}

httpServer.listen(PORT, () => {
  console.log(`Dvorovyi Bridge WS server listening on http://localhost:${PORT}`);
  if (BOT_TOKEN) {
    void fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: `${PUBLIC_URL}/tg-webhook` }),
    }).catch(() => {});
  }
});
