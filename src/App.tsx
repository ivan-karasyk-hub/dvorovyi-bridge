import React, { useCallback, useEffect, useRef, useState } from 'react';
import { applyAction, createMatch } from './shared/gameEngine';
import { applyDurakAction, createDurakMatch } from './shared/durakEngine';
import type {
  ClientMessage,
  DurakAction,
  DurakMode,
  DurakState,
  GameAction,
  GameState,
  GameType,
  RoomInfo,
  ServerMessage,
  WalletSummary,
} from './shared/types';
import {
  getOrCreateLocalPlayerId,
  getStartRoomCode,
  getTelegramUser,
  initTelegramApp,
} from './utils/telegram';
import { LobbyScreen } from './components/LobbyScreen';
import { GameTable } from './components/GameTable';
import { DurakTable } from './components/DurakTable';

function getWsUrl(): string {
  const custom = import.meta.env.VITE_WS_URL as string | undefined;
  if (custom) return custom;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

export const App: React.FC = () => {
  const [playerId] = useState(() => getOrCreateLocalPlayerId());
  const [playerName, setPlayerName] = useState(() => {
    const tg = getTelegramUser();
    if (tg) return tg.name;
    return localStorage.getItem('bridge_player_name') || 'Гравець';
  });
  const [avatarUrl] = useState(() => getTelegramUser()?.avatarUrl);
  const [initialRoomCode] = useState(() => getStartRoomCode());

  const [wsConnected, setWsConnected] = useState(false);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [onlineState, setOnlineState] = useState<GameState | null>(null);
  const [onlineDurakState, setOnlineDurakState] = useState<DurakState | null>(null);
  const [sandboxState, setSandboxState] = useState<GameState | null>(null);
  const [sandboxDurakState, setSandboxDurakState] = useState<DurakState | null>(null);
  const [selectedGameType, setSelectedGameType] = useState<GameType>('bridge');
  const [selectedDurakMode, setSelectedDurakMode] = useState<DurakMode>('podkidnoy');
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [leaderboard, setLeaderboard] = useState<WalletSummary[]>([]);
  const [adminWallets, setAdminWallets] = useState<WalletSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const autoJoinedRef = useRef(false);

  useEffect(() => {
    initTelegramApp();
  }, []);

  const handleNameChange = (name: string) => {
    setPlayerName(name);
    localStorage.setItem('bridge_player_name', name);
  };

  const sendWs = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    let closed = false;
    let reconnectTimer: number | undefined;

    const connect = () => {
      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        if (closed) return;
        setWsConnected(true);
        setError(null);

        ws.send(
          JSON.stringify({
            type: 'GET_WALLET',
            playerId,
            playerName,
          } satisfies ClientMessage),
        );

        if (initialRoomCode && !autoJoinedRef.current) {
          autoJoinedRef.current = true;
          ws.send(
            JSON.stringify({
              type: 'JOIN_ROOM',
              code: initialRoomCode,
              playerName,
              playerId,
              avatarUrl,
            } satisfies ClientMessage),
          );
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as ServerMessage;
          if (msg.type === 'ROOM_STATE') {
            setRoom(msg.room);
            setError(null);
          } else if (msg.type === 'GAME_STATE') {
            setOnlineState(msg.state);
          } else if (msg.type === 'DURAK_STATE') {
            setOnlineDurakState(msg.state);
          } else if (msg.type === 'WALLET_UPDATE') {
            setWallet(msg.wallet);
          } else if (msg.type === 'LEADERBOARD') {
            setLeaderboard(msg.entries);
          } else if (msg.type === 'ADMIN_WALLETS') {
            setAdminWallets(msg.entries);
          } else if (msg.type === 'ERROR') {
            setError(msg.message);
          }
        } catch {
          // Ignore malformed message
        }
      };

      ws.onclose = () => {
        if (closed) return;
        setWsConnected(false);
        reconnectTimer = window.setTimeout(connect, 2500);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [avatarUrl, initialRoomCode, playerId]);

  const handleCreateRoom = () => {
    setError(null);
    sendWs({
      type: 'CREATE_ROOM',
      playerName,
      playerId,
      avatarUrl,
      gameType: selectedGameType,
      durakMode: selectedDurakMode,
    });
  };

  const handleJoinRoom = (code: string) => {
    setError(null);
    sendWs({ type: 'JOIN_ROOM', code, playerName, playerId, avatarUrl });
  };

  const handleSetRoomGame = (gameType: GameType, durakMode: DurakMode) => {
    if (!room) return;
    sendWs({ type: 'SET_ROOM_GAME', code: room.code, playerId, gameType, durakMode });
  };

  const handleAddBot = () => {
    if (!room) return;
    sendWs({ type: 'ADD_BOT', code: room.code, playerId });
  };

  const handleRemoveBot = (botId: string) => {
    if (!room) return;
    sendWs({ type: 'REMOVE_BOT', code: room.code, playerId, botId });
  };

  const handleStartOnlineGame = () => {
    if (!room) return;
    sendWs({ type: 'START_GAME', code: room.code, playerId });
  };

  const handleLeaveRoom = () => {
    if (room) {
      sendWs({ type: 'LEAVE_ROOM', code: room.code, playerId });
    }
    setRoom(null);
    setOnlineState(null);
    setOnlineDurakState(null);
    setSandboxState(null);
    setSandboxDurakState(null);
  };

  const handleStartSandbox = (count: 2 | 3 | 4 | 5 | 6) => {
    const players = Array.from({ length: count }, (_, idx) => ({
      id: `sandbox_${idx + 1}`,
      name: idx === 0 ? playerName.trim() || 'Гравець 1' : `Гравець ${idx + 1}`,
    }));
    if (selectedGameType === 'durak') {
      setSandboxDurakState(createDurakMatch(players, selectedDurakMode));
    } else {
      setSandboxState(createMatch(players));
    }
  };

  const handleOnlineAction = (action: GameAction) => {
    if (!room) return;
    sendWs({ type: 'GAME_ACTION', code: room.code, action });
  };

  const handleOnlineDurakAction = (action: DurakAction) => {
    if (!room) return;
    sendWs({ type: 'DURAK_ACTION', code: room.code, action });
  };

  if (sandboxDurakState) {
    return (
      <DurakTable
        state={sandboxDurakState}
        myPlayerId={sandboxDurakState.players[sandboxDurakState.attackerIndex].id}
        isSandbox
        onAction={(action) =>
          setSandboxDurakState((prev) => (prev ? applyDurakAction(prev, action) : null))
        }
        onLeave={() => setSandboxDurakState(null)}
      />
    );
  }

  if (sandboxState) {
    return (
      <GameTable
        state={sandboxState}
        myPlayerId={sandboxState.players[sandboxState.currentPlayerIndex].id}
        isSandbox
        onAction={(action) =>
          setSandboxState((prev) => (prev ? applyAction(prev, action) : null))
        }
        onLeave={() => setSandboxState(null)}
      />
    );
  }

  if (onlineDurakState && room) {
    return (
      <DurakTable
        state={onlineDurakState}
        myPlayerId={playerId}
        isSandbox={false}
        roomCode={room.code}
        onAction={handleOnlineDurakAction}
        onLeave={handleLeaveRoom}
      />
    );
  }

  if (onlineState && room) {
    return (
      <GameTable
        state={onlineState}
        myPlayerId={playerId}
        isSandbox={false}
        roomCode={room.code}
        onAction={handleOnlineAction}
        onLeave={handleLeaveRoom}
      />
    );
  }

  return (
    <LobbyScreen
      playerName={playerName}
      onChangeName={handleNameChange}
      room={room}
      connected={wsConnected}
      error={error}
      initialJoinCode={initialRoomCode}
      wallet={wallet}
      leaderboard={leaderboard}
      adminWallets={adminWallets}
      selectedGameType={selectedGameType}
      selectedDurakMode={selectedDurakMode}
      onSelectGameType={setSelectedGameType}
      onSelectDurakMode={setSelectedDurakMode}
      onSetRoomGame={handleSetRoomGame}
      onClaimBonus={() => sendWs({ type: 'CLAIM_BONUS', playerId, playerName })}
      onFetchLeaderboard={() => sendWs({ type: 'GET_LEADERBOARD' })}
      onFetchAdminWallets={() =>
        sendWs({ type: 'ADMIN_GET_WALLETS', adminPlayerId: playerId })
      }
      onAdminAdjustChips={(targetId, delta) =>
        sendWs({
          type: 'ADMIN_ADJUST_CHIPS',
          adminPlayerId: playerId,
          targetId,
          delta,
        })
      }
      onCreateRoom={handleCreateRoom}
      onJoinRoom={handleJoinRoom}
      onAddBot={handleAddBot}
      onRemoveBot={handleRemoveBot}
      onStartOnlineGame={handleStartOnlineGame}
      onLeaveRoom={handleLeaveRoom}
      onStartSandbox={handleStartSandbox}
      currentPlayerId={playerId}
    />
  );
};

export default App;
