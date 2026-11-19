import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, LogOut, MessageCircle, RotateCcw, Vote } from 'lucide-react';
import type { ChatMessage, SpyAction, SpyState } from '../shared/types';
import { ChatDrawer } from './ChatDrawer';
import { triggerHaptic } from '../utils/telegram';

interface SpyTableProps {
  state: SpyState;
  myPlayerId: string;
  roomCode: string;
  chatMessages: ChatMessage[];
  onSendChat: (text: string) => void;
  onAction: (action: SpyAction) => void;
  onLeave: () => void;
}

export const SpyTable: React.FC<SpyTableProps> = ({
  state,
  myPlayerId,
  roomCode,
  chatMessages,
  onSendChat,
  onAction,
  onLeave,
}) => {
  const [hideSecret, setHideSecret] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [lastReadChatLen, setLastReadChatLen] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (chatOpen) setLastReadChatLen(chatMessages.length);
  }, [chatOpen, chatMessages.length]);

  const unreadChatCount = chatOpen
    ? 0
    : chatMessages.slice(lastReadChatLen).filter((m) => m.senderId !== myPlayerId).length;

  const me = state.players.find((p) => p.id === myPlayerId);
  const secLeft = Math.max(0, Math.floor((state.endsAt - now) / 1000));
  const mins = String(Math.floor(secLeft / 60)).padStart(2, '0');
  const secs = String(secLeft % 60).padStart(2, '0');

  return (
    <div className="min-h-screen w-full felt-table flex flex-col justify-between p-3 sm:p-4 text-white">
      {/* Top Bar */}
      <header className="flex items-center justify-between gap-2 bg-black/35 border border-white/15 rounded-2xl px-3 py-2 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="text-lg">🕵️</span>
          <div>
            <div className="text-xs sm:text-sm font-extrabold text-amber-300">
              Шпигун • {roomCode}
            </div>
            <div className="text-[11px] text-emerald-200/80">
              Раунд {state.round} • ⏱ {mins}:{secs}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="relative px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold flex items-center gap-1"
          >
            <MessageCircle className="w-4 h-4" />
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow">
                {unreadChatCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 text-xs font-bold flex items-center gap-1"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Вийти</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3 my-3 max-w-lg mx-auto w-full">
        {/* Role Card */}
        <div className="w-full rounded-2xl bg-black/40 border border-white/15 p-4 text-center space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-200/75 font-bold">Ваша картка</span>
            <button
              type="button"
              onClick={() => setHideSecret((v) => !v)}
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20"
            >
              {hideSecret ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              {hideSecret ? 'Показати' : 'Сховати'}
            </button>
          </div>
          {hideSecret ? (
            <div className="py-4 text-sm text-white/50 font-bold">Картку приховано</div>
          ) : me?.isSpy ? (
            <div className="py-2 space-y-1">
              <div className="text-xl font-black text-rose-400">🕵️ ВИ — ШПИГУН!</div>
              <div className="text-xs text-white/75">
                Не видайте себе! Слухайте підказки й спробуйте вгадати локацію.
              </div>
            </div>
          ) : (
            <div className="py-2 space-y-1">
              <div className="text-xs text-emerald-200/80">Локація:</div>
              <div className="text-2xl font-black text-amber-300">{state.location}</div>
              <div className="text-xs text-white/90">
                Ваша роль: <b className="text-emerald-300">{me?.role}</b>
              </div>
            </div>
          )}
        </div>

        {/* Phase Specific UI */}
        {state.phase === 'playing' && (
          <div className="w-full rounded-2xl bg-black/30 border border-white/15 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-200">
                Гравці ({state.players.length})
              </span>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  onAction({ type: 'SPY_START_VOTE', playerId: myPlayerId });
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs flex items-center gap-1.5"
              >
                <Vote className="w-3.5 h-3.5" />
                Голосувати
              </button>
            </div>

            {me?.isSpy && (
              <div className="space-y-1.5 pt-2 border-t border-white/10">
                <div className="text-[11px] font-bold text-rose-300">
                  Ризикнути та вгадати локацію (миттєвий фінал):
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
                  {state.allLocations.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => {
                        triggerHaptic('heavy');
                        onAction({ type: 'SPY_GUESS_LOCATION', playerId: myPlayerId, location: loc });
                      }}
                      className="px-2 py-1.5 rounded-lg bg-white/10 hover:bg-rose-500/40 text-[11px] font-semibold text-left truncate"
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {state.phase === 'voting' && (
          <div className="w-full rounded-2xl bg-black/40 border border-amber-400/40 p-4 space-y-2.5">
            <div className="text-sm font-black text-amber-300 text-center">
              🗳 Голосування: хто шпигун?
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {state.players
                .filter((p) => p.id !== myPlayerId)
                .map((p) => {
                  const chosen = me?.votedForId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={Boolean(me?.votedForId)}
                      onClick={() => {
                        triggerHaptic('medium');
                        onAction({ type: 'SPY_VOTE', playerId: myPlayerId, targetId: p.id });
                      }}
                      className={`py-2.5 px-3 rounded-xl text-xs font-extrabold border transition ${
                        chosen
                          ? 'bg-amber-400 text-slate-950 border-amber-300'
                          : 'bg-white/10 hover:bg-white/20 text-white border-white/15 disabled:opacity-50'
                      }`}
                    >
                      {p.name}
                    </button>
                  );
                })}
            </div>
            {me?.votedForId && (
              <div className="text-center text-xs text-emerald-200/80">
                Ви проголосували. Очікуємо інших...
              </div>
            )}
          </div>
        )}

        {state.phase === 'finished' && (
          <div className="w-full rounded-2xl bg-black/50 border border-amber-400/50 p-4 text-center space-y-3">
            <div className="text-lg font-black text-amber-300">
              {state.winner === 'citizens' ? '🎉 Перемога мирних!' : '🕵️ Перемога шпигуна!'}
            </div>
            <div className="text-xs text-white/90">{state.winReason}</div>
            <button
              type="button"
              onClick={() => onAction({ type: 'SPY_NEW_ROUND', playerId: myPlayerId })}
              className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Наступний раунд
            </button>
          </div>
        )}
      </div>

      {chatOpen && (
        <ChatDrawer
          title={`Чат кімнати ${roomCode}`}
          messages={chatMessages}
          myPlayerId={myPlayerId}
          onSend={onSendChat}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
};
