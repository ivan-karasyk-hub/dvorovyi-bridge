import React, { useEffect, useState } from 'react';
import { LogOut, MessageCircle, RotateCcw, ScrollText } from 'lucide-react';
import type {
  Card,
  ChatMessage,
  HoldemCard,
  MultiBlackjackAction,
  MultiBlackjackState,
} from '../shared/types';
import { PlayingCard } from './PlayingCard';
import { ChatDrawer } from './ChatDrawer';
import { LogsModal } from './LogsModal';
import { triggerHaptic } from '../utils/telegram';

interface MultiBlackjackTableProps {
  state: MultiBlackjackState;
  myPlayerId: string;
  myChips: number;
  roomCode: string;
  chatMessages: ChatMessage[];
  onSendChat: (text: string) => void;
  onAction: (action: MultiBlackjackAction) => void;
  onLeave: () => void;
}

const BET_AMOUNTS = [10, 25, 50, 100, 250];

function asDisplayCard(c: HoldemCard): Card {
  return { id: c.id, suit: c.suit, rank: c.rank as Card['rank'] };
}

export const MultiBlackjackTable: React.FC<MultiBlackjackTableProps> = ({
  state,
  myPlayerId,
  myChips,
  roomCode,
  chatMessages,
  onSendChat,
  onAction,
  onLeave,
}) => {
  const [selectedBet, setSelectedBet] = useState(25);
  const [chatOpen, setChatOpen] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [lastReadChatLen, setLastReadChatLen] = useState(0);
  const unreadChatCount = chatOpen
    ? 0
    : chatMessages.slice(lastReadChatLen).filter((m) => m.senderId !== myPlayerId).length;
  useEffect(() => {
    if (chatOpen) {
      setLastReadChatLen(chatMessages.length);
    }
  }, [chatOpen, chatMessages.length]);

  const me = state.players.find((p) => p.id === myPlayerId);
  const currentPlayer = state.players[state.currentPlayerIndex];
  const isMyTurn = state.phase === 'playing' && currentPlayer?.id === myPlayerId;

  const statusLabel = (p: MultiBlackjackState['players'][number]) => {
    if (p.outcome === 'blackjack') return { text: `БЛЕКДЖЕК! +${p.payout}`, cls: 'bg-amber-400 text-slate-950' };
    if (p.outcome === 'win') return { text: `ПЕРЕМОГА +${p.payout}`, cls: 'bg-emerald-500 text-slate-950' };
    if (p.outcome === 'push') return { text: `НІЧИЯ (${p.payout})`, cls: 'bg-sky-400 text-slate-950' };
    if (p.outcome === 'lose') return { text: 'ПРОГРАШ', cls: 'bg-rose-500 text-white' };
    if (p.status === 'betting') return { text: 'Ставка...', cls: 'bg-white/15 text-emerald-100' };
    if (p.status === 'blackjack') return { text: '21! Блекджек', cls: 'bg-amber-400 text-slate-950' };
    if (p.status === 'busted') return { text: 'Перебір', cls: 'bg-rose-500/80 text-white' };
    if (p.status === 'stood') return { text: 'Досить', cls: 'bg-white/20 text-white' };
    if (state.phase === 'playing' && currentPlayer?.id === p.id) {
      return { text: 'Хід зараз', cls: 'bg-amber-400 text-slate-950 animate-pulse' };
    }
    return { text: 'Готовий', cls: 'bg-white/15 text-emerald-100' };
  };

  return (
    <div className="h-[100dvh] w-full felt-table flex flex-col justify-between p-2 sm:p-4 text-white select-none overflow-hidden safe-top safe-bottom">
      {/* Top Bar */}
      <header className="shrink-0 flex items-center justify-between gap-2 bg-black/35 border border-white/15 rounded-2xl px-3 py-2 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="text-lg">🃏</span>
          <div>
            <div className="text-xs sm:text-sm font-extrabold text-amber-300">
              Блекджек 21 • {roomCode}
            </div>
            <div className="text-[11px] text-emerald-200/80">
              Раунд {state.round} • Гравців: {state.players.length}/4
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-xl bg-amber-400/15 border border-amber-400/35 text-amber-200 text-xs font-extrabold">
            🪙 {myChips}
          </span>
          <button
            type="button"
            onClick={() => setShowLogs(true)}
            className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-amber-200 text-xs font-bold flex items-center"
            title="Історія ходів"
          >
            <ScrollText className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="relative px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold flex items-center gap-1"
            title="Чат кімнати"
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

      {/* Scrollable Middle: Dealer + Players */}
      <div className="flex-1 min-h-0 overflow-y-auto py-2 flex flex-col gap-2">
        {/* Dealer Area */}
        <div className="flex flex-col items-center shrink-0">
          <div className="bg-black/30 border border-white/15 rounded-2xl px-3 py-2 flex flex-col items-center min-w-[200px]">
            <div className="text-xs text-emerald-200/80 font-bold mb-1.5">
              🎩 Дилер {state.dealerHand.length > 0 ? `• ${state.dealerScore} очок` : ''}
            </div>
            {state.dealerHand.length === 0 ? (
              <div className="text-xs text-emerald-200/60 py-2">Очікування ставок...</div>
            ) : (
              <div className="flex items-center justify-center gap-1.5">
                {state.dealerHand.map((c) => (
                  <PlayingCard key={c.id} card={asDisplayCard(c)} size="sm" />
                ))}
                {state.phase === 'playing' && state.dealerHand.length === 1 && (
                  <div className="w-12 h-[68px] sm:w-14 sm:h-20 rounded-xl bg-gradient-to-br from-emerald-700 to-emerald-950 border-2 border-amber-400/50 flex items-center justify-center text-amber-300 font-black text-lg shadow-lg">
                    ?
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Players Grid (1 to 4 players) */}
        <div
          className={`grid gap-2 ${
            state.players.length === 1
              ? 'grid-cols-1 max-w-md mx-auto w-full'
              : state.players.length === 2
                ? 'grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto w-full'
                : 'grid-cols-2 lg:grid-cols-4 w-full'
          }`}
        >
          {state.players.map((p) => {
            const isActive = state.phase === 'playing' && currentPlayer?.id === p.id;
            const isMe = p.id === myPlayerId;
            const badge = statusLabel(p);
            return (
              <div
                key={p.id}
                className={`rounded-2xl p-2 sm:p-3 border backdrop-blur-md transition ${
                  isActive
                    ? 'bg-amber-500/15 border-amber-400 shadow-lg shadow-amber-500/20'
                    : isMe
                      ? 'bg-black/40 border-emerald-400/45'
                      : 'bg-black/30 border-white/15'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold truncate">
                      {p.isBot ? '🤖 ' : ''}
                      {p.name} {isMe ? '(Ви)' : ''}
                    </div>
                    <div className="text-[10px] text-amber-300 font-bold">
                      {p.bet > 0 ? `🪙 ${p.bet}` : 'Без ставки'}
                      {p.hand.length > 0 ? ` • ${p.score} оч.` : ''}
                    </div>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded-lg text-[9px] font-black shrink-0 ${badge.cls}`}>
                    {badge.text}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1 min-h-[48px] sm:min-h-[68px]">
                  {p.hand.length === 0 ? (
                    <span className="text-[11px] text-emerald-200/50">
                      {p.status === 'betting' ? 'Обирає ставку...' : 'Готовий'}
                    </span>
                  ) : (
                    p.hand.map((c) => (
                      <PlayingCard key={c.id} card={asDisplayCard(c)} size="sm" />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="shrink-0 bg-black/45 border border-white/15 rounded-2xl p-2.5 sm:p-3 backdrop-blur-md max-w-2xl mx-auto w-full">
        {state.phase === 'betting' && me && (
          me.status === 'betting' ? (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {BET_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setSelectedBet(amt)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
                      selectedBet === amt
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-white/10 text-emerald-100 hover:bg-white/20'
                    }`}
                  >
                    🪙 {amt}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={myChips < selectedBet}
                onClick={() => {
                  triggerHaptic('medium');
                  onAction({ type: 'BJ_PLACE_BET', playerId: myPlayerId, bet: selectedBet });
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black text-sm disabled:opacity-40"
              >
                🃏 Поставити 🪙 {selectedBet}
              </button>
            </div>
          ) : (
            <div className="text-center text-xs text-emerald-200 py-2 font-bold">
              Ставку зроблено (🪙 {me.bet}). Очікуємо інших гравців...
            </div>
          )
        )}

        {state.phase === 'playing' && (
          isMyTurn ? (
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  onAction({ type: 'BJ_HIT', playerId: myPlayerId });
                }}
                className="py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm"
              >
                🃏 Ще
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  onAction({ type: 'BJ_STAND', playerId: myPlayerId });
                }}
                className="py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm"
              >
                ✋ Досить
              </button>
              <button
                type="button"
                disabled={!me || me.hand.length !== 2 || myChips < (me?.bet ?? 0)}
                onClick={() => {
                  triggerHaptic('heavy');
                  onAction({ type: 'BJ_DOUBLE', playerId: myPlayerId });
                }}
                className="py-3 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 font-black text-sm disabled:opacity-40"
              >
                ⚡ x2
              </button>
            </div>
          ) : (
            <div className="text-center text-xs text-amber-200 py-2 font-bold">
              Зараз ходить: {currentPlayer?.name ?? '...'}
            </div>
          )
        )}

        {state.phase === 'finished' && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic('medium');
              onAction({ type: 'BJ_NEW_ROUND', playerId: myPlayerId });
            }}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Новий раунд
          </button>
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
      {showLogs && <LogsModal logs={state.logs} onClose={() => setShowLogs(false)} />}
    </div>
  );
};
