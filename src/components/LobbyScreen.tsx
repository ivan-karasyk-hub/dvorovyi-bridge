import React, { useState } from 'react';
import { Users, Play, Copy, Check, Eye, Plus, LogIn, Wifi, WifiOff, Bot, X, Send } from 'lucide-react';
import type { RoomInfo } from '../shared/types';
import { copyTextToClipboard, getRoomInviteUrl, shareRoomInTelegram } from '../utils/telegram';

interface LobbyScreenProps {
  playerName: string;
  onChangeName: (name: string) => void;
  room: RoomInfo | null;
  connected: boolean;
  error: string | null;
  initialJoinCode?: string | null;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onAddBot: () => void;
  onRemoveBot: (botId: string) => void;
  onStartOnlineGame: () => void;
  onLeaveRoom: () => void;
  onStartSandbox: (playerCount: 2 | 3 | 4 | 5 | 6) => void;
  currentPlayerId: string;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  playerName,
  onChangeName,
  room,
  connected,
  error,
  initialJoinCode,
  onCreateRoom,
  onJoinRoom,
  onAddBot,
  onRemoveBot,
  onStartOnlineGame,
  onLeaveRoom,
  onStartSandbox,
  currentPlayerId,
}) => {
  const [joinCode, setJoinCode] = useState(initialJoinCode ?? '');
  const [sandboxCount, setSandboxCount] = useState<2 | 3 | 4 | 5 | 6>(2);
  const [copied, setCopied] = useState(false);

  const handleCopyInvite = async () => {
    if (!room) return;
    const url = getRoomInviteUrl(room.code);
    const ok = await copyTextToClipboard(url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      window.prompt('Скопіюйте посилання вручну:', url);
    }
  };

  if (room) {
    const isHost = room.players.find((p) => p.id === currentPlayerId)?.isHost ?? false;

    return (
      <div className="min-h-full felt-table flex flex-col items-center justify-center p-4 safe-top safe-bottom">
        <div className="w-full max-w-sm rounded-3xl bg-black/35 backdrop-blur-md border border-emerald-400/25 p-5 shadow-2xl space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-emerald-300/80">
                Кімната для друзів
              </div>
              <div className="text-3xl font-black tracking-widest text-amber-300 mt-0.5">
                {room.code}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => shareRoomInTelegram(room.code)}
                className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-xs font-bold text-white active:scale-95 transition shadow"
                title="Обрати контакт або чат у Telegram"
              >
                <Send className="w-3.5 h-3.5" />
                У ТГ
              </button>
              <button
                type="button"
                onClick={handleCopyInvite}
                className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white active:scale-95 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Ок' : 'Лінк'}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-emerald-200/80 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Гравці ({room.players.length}/6):
              </span>
              {isHost && room.players.length < 6 && (
                <button
                  type="button"
                  onClick={onAddBot}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-400/20 hover:bg-sky-400/30 border border-sky-400/35 text-sky-200 text-[11px] font-bold active:scale-95 transition"
                >
                  <Bot className="w-3.5 h-3.5" />
                  + Додати бота
                </button>
              )}
            </div>
            {room.players.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/5 border border-white/10"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      p.connected ? 'bg-emerald-400' : 'bg-rose-400'
                    }`}
                  />
                  {p.isBot && <Bot className="w-3.5 h-3.5 text-sky-300 shrink-0" />}
                  <span className="font-medium text-sm text-white truncate">
                    {p.name}
                    {p.id === currentPlayerId && ' (Ви)'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {p.isHost && (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                      Хост
                    </span>
                  )}
                  {isHost && p.isBot && (
                    <button
                      type="button"
                      onClick={() => onRemoveBot(p.id)}
                      className="p-1 rounded-md bg-white/10 hover:bg-rose-500/40 text-white/70 hover:text-white transition"
                      title="Прибрати бота"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div className="text-xs text-rose-300 bg-rose-950/60 border border-rose-400/30 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onLeaveRoom}
              className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-semibold text-white/90"
            >
              Вийти
            </button>
            {isHost ? (
              <button
                type="button"
                disabled={room.players.length < 2}
                onClick={onStartOnlineGame}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:pointer-events-none text-slate-950 font-extrabold text-sm shadow-lg active:scale-95 transition"
              >
                <Play className="w-4 h-4 fill-current" />
                Почати гру
              </button>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-emerald-200/80 bg-white/5 rounded-xl px-3">
                Очікуємо старт від хоста...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full felt-table flex flex-col items-center justify-center p-4 safe-top safe-bottom overflow-y-auto">
      <div className="w-full max-w-sm space-y-4">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/30 border border-white/10 text-[11px] text-emerald-200">
            {connected ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" /> Сервер онлайн
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" /> Офлайн (доступна Пісочниця)
              </>
            )}
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">Карасьовий Брідж</h1>
          <p className="text-xs text-emerald-200/75">Гра до 125 очок • 2–6 гравців</p>
        </div>

        {/* Player Name */}
        <div className="rounded-2xl bg-black/30 backdrop-blur-md border border-white/10 p-4 space-y-2">
          <label className="block text-xs font-semibold text-emerald-200/90">Ваше ім'я</label>
          <input
            type="text"
            value={playerName}
            maxLength={18}
            onChange={(e) => onChangeName(e.target.value)}
            placeholder="Введіть ім'я..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder-white/40 text-sm focus:outline-none focus:border-amber-400"
          />
        </div>

        {error && (
          <div className="text-xs text-rose-300 bg-rose-950/70 border border-rose-400/30 rounded-xl px-3.5 py-2.5">
            {error}
          </div>
        )}

        {/* Friends Multiplayer */}
        <div className="rounded-2xl bg-black/30 backdrop-blur-md border border-emerald-400/25 p-4 space-y-3">
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" />
            Грати з друзями
          </div>

          <button
            type="button"
            disabled={!connected}
            onClick={onCreateRoom}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-extrabold text-sm shadow-lg active:scale-95 transition"
          >
            <Plus className="w-4 h-4" />
            Створити кімнату
          </button>

          <div className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              maxLength={4}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="КОД"
              className="w-28 px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-center font-bold tracking-widest text-white placeholder-white/40 text-sm uppercase focus:outline-none focus:border-emerald-400"
            />
            <button
              type="button"
              disabled={!connected || joinCode.trim().length < 4}
              onClick={() => onJoinRoom(joinCode)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold text-sm active:scale-95 transition"
            >
              <LogIn className="w-4 h-4" />
              Увійти
            </button>
          </div>
        </div>

        {/* Local Sandbox Mode */}
        <div className="rounded-2xl bg-black/25 backdrop-blur-md border border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <Eye className="w-4 h-4 text-sky-400" />
              Пісочниця (тест правил)
            </div>
            <div className="flex gap-1">
              {([2, 3, 4, 5, 6] as const).map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setSandboxCount(cnt)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition ${
                    sandboxCount === cnt
                      ? 'bg-sky-400 text-slate-950'
                      : 'bg-white/10 text-white/75 hover:bg-white/20'
                  }`}
                >
                  {cnt}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-emerald-200/70">
            Локальний стіл на 2–6 гравців з відкритими картами для перевірки всіх правил і комбінацій.
          </p>
          <button
            type="button"
            onClick={() => onStartSandbox(sandboxCount)}
            className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-sm active:scale-95 transition"
          >
            Запустити Пісочницю ({sandboxCount} гравці)
          </button>
        </div>
      </div>
    </div>
  );
};
