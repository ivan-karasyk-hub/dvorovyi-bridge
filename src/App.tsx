import React, { useCallback, useEffect, useRef, useState } from 'react';
import { applyAction, createMatch } from './shared/gameEngine';
import type {
  ClientMessage,
  GameAction,
  GameState,
  RoomInfo,
  ServerMessage,
} from './shared/types';
import {
  getOrCreateLocalPlayerId,
  getStartRoomCode,
  getTelegramUser,
  initTelegramApp,
} from './utils/telegram';
import { LobbyScreen } from './components/LobbyScreen';
import { GameTable } from './components/GameTable';

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
  const [sandboxState, setSandboxState] = useState<GameState | null>(null);
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
    sendWs({ type: 'CREATE_ROOM', playerName, playerId, avatarUrl });
  };

  const handleJoinRoom = (code: string) => {
    setError(null);
    sendWs({ type: 'JOIN_ROOM', code, playerName, playerId, avatarUrl });
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
    setSandboxState(null);
  };

  const handleStartSandbox = (count: 2 | 3 | 4 | 5 | 6) => {
    const players = Array.from({ length: count }, (_, idx) => ({
      id: `sandbox_${idx + 1}`,
      name: idx === 0 ? playerName.trim() || 'Гравець 1' : `Гравець ${idx + 1}`,
    }));
    setSandboxState(createMatch(players));
  };

  const handleOnlineAction = (action: GameAction) => {
    if (!room) return;
    sendWs({ type: 'GAME_ACTION', code: room.code, action });
  };

  const handleSandboxAction = (action: GameAction) => {
    setSandboxState((prev) => (prev ? applyAction(prev, action) : null));
  };

  if (sandboxState) {
    return (
      <GameTable
        state={sandboxState}
        myPlayerId={sandboxState.players[sandboxState.currentPlayerIndex].id}
        isSandbox
        onAction={handleSandboxAction}
        onLeave={() => setSandboxState(null)}
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
