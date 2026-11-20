import React, { useEffect, useState } from 'react';
import { LogOut, MessageCircle, RotateCcw, ScrollText } from 'lucide-react';
import type { ChatMessage, DebertsAction, DebertsState, Suit } from '../shared/types';
import { isDebertsCardPlayable } from '../shared/debertsEngine';
import { SUIT_NAMES_UK, SUIT_SYMBOLS } from '../shared/gameEngine';
import { PlayingCard } from './PlayingCard';
import { ChatDrawer } from './ChatDrawer';
import { LogsModal } from './LogsModal';
import { triggerHaptic } from '../utils/telegram';

interface DebertsTableProps {
  state: DebertsState;
  myPlayerId: string;
  roomCode: string;
  chatMessages: ChatMessage[];
  onSendChat: (text: string) => void;
  onAction: (action: DebertsAction) => void;
  onLeave: () => void;
}

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

export const DebertsTable: React.FC<DebertsTableProps> = ({
  state,
  myPlayerId,
  roomCode,
  chatMessages,
  onSendChat,
  onAction,
  onLeave,
}) => {
  const [chatOpen, setChatOpen] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [lastReadChatLen, setLastReadChatLen] = useState(0);

  useEffect(() => {
    if (chatOpen) setLastReadChatLen(chatMessages.length);
  }, [chatOpen, chatMessages.length]);

  const unreadChatCount = chatOpen
    ? 0
    : chatMessages.slice(lastReadChatLen).filter((m) => m.senderId !== myPlayerId).length;

  const me = state.players.find((p) => p.id === myPlayerId);
  const activePlayer = state.players[state.currentPlayerIndex];
  const isMyTurn = activePlayer?.id === myPlayerId;

  return (
    <div className="h-[100dvh] w-full felt-table flex flex-col justify-between p-2.5 sm:p-4 text-white overflow-hidden safe-top safe-bottom">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between gap-2 bg-black/35 border border-white/15 rounded-2xl px-3 py-2 backdrop-blur-md">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">🂡</span>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-extrabold text-amber-300 truncate">
              Деберц • {roomCode}
            </div>
            <div className="text-[11px] text-emerald-200/80">
              Раунд {state.round} • Козир: {SUIT_SYMBOLS[state.trumpSuit]}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowLogs(true)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-amber-200"
            title="Історія ходів"
          >
            <ScrollText className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="relative p-2 rounded-xl bg-white/10 hover:bg-white/20 text-emerald-200"
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
            className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 text-rose-200"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Scoreboard Strip */}
      <div className="shrink-0 flex flex-wrap justify-center gap-2 my-1.5">
        {state.players.map((p) => {
          const isTurn = (state.phase === 'bidding' || state.phase === 'playing') && activePlayer?.id === p.id;
          return (
            <div
              key={p.id}
              className={`px-3 py-1.5 rounded-xl border text-xs ${
                isTurn
                  ? 'bg-amber-400/20 border-amber-400 text-amber-200 font-extrabold'
                  : 'bg-black/30 border-white/15 text-white/85'
              }`}
            >
              {p.isBot ? '🤖 ' : ''}
              {p.name}: <b>{p.totalScore}</b> <span className="text-[10px] opacity-75">(+{p.roundPoints})</span>
            </div>
          );
        })}
      </div>

      {/* Table Center */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3">
        {state.phase === 'bidding' && (
          <div className="rounded-2xl bg-black/40 border border-amber-400/40 p-4 text-center space-y-3 max-w-sm w-full">
            <div className="text-xs text-emerald-200 font-bold">
              Торги за козир (коло {state.bidRound}/2)
            </div>
            {state.proposedTrumpCard && (
              <div className="flex justify-center">
                <PlayingCard card={state.proposedTrumpCard} size="md" />
              </div>
            )}
            {isMyTurn ? (
              state.bidRound === 1 ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('medium');
                      onAction({ type: 'DEBERTS_ACCEPT_TRUMP', playerId: myPlayerId });
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs"
                  >
                    Взяти {SUIT_SYMBOLS[state.trumpSuit]}
                  </button>
                  <button
                    type="button"
                    onClick={() => onAction({ type: 'DEBERTS_PASS_BID', playerId: myPlayerId })}
                    className="flex-1 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs"
                  >
                    Пас
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-1.5">
                    {SUITS.filter((s) => s !== state.proposedTrumpCard?.suit).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          triggerHaptic('medium');
                          onAction({ type: 'DEBERTS_CHOOSE_TRUMP', playerId: myPlayerId, suit: s });
                        }}
                        className="py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs"
                      >
                        {SUIT_NAMES_UK[s]}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => onAction({ type: 'DEBERTS_PASS_BID', playerId: myPlayerId })}
                    className="w-full py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs"
                  >
                    Пас
                  </button>
                </div>
              )
            ) : (
              <div className="text-xs text-amber-200">Очікуємо рішення: {activePlayer?.name}</div>
            )}
          </div>
        )}

        {state.phase === 'playing' && (
          <div className="flex flex-col items-center gap-2">
            <div className="text-xs text-emerald-200/80 font-bold">
              {isMyTurn ? 'Ваш хід!' : `Хід: ${activePlayer?.name}`}
            </div>
            <div className="flex items-center justify-center gap-2 min-h-[100px] px-4 py-3 rounded-2xl bg-black/25 border border-white/15">
              {state.trick.length === 0 ? (
                <span className="text-xs text-white/45">Стіл порожній</span>
              ) : (
                state.trick.map((t) => {
                  const p = state.players.find((pl) => pl.id === t.playerId);
                  return (
                    <div key={t.card.id} className="flex flex-col items-center gap-1">
                      <PlayingCard card={t.card} size="md" />
                      <span className="text-[10px] text-white/75">{p?.name}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {(state.phase === 'round_over' || state.phase === 'match_over') && (
          <div className="rounded-2xl bg-black/50 border border-amber-400/50 p-4 text-center space-y-3 max-w-sm w-full">
            <div className="text-lg font-black text-amber-300">
              {state.phase === 'match_over' ? '🏆 Матч завершено!' : `Раунд ${state.round} завершено!`}
            </div>
            <div className="space-y-1 text-xs">
              {state.players.map((p) => (
                <div key={p.id} className="flex justify-between px-2 py-1 rounded bg-white/5">
                  <span>{p.name}</span>
                  <span className="font-bold text-amber-300">
                    {p.totalScore} очок (+{p.roundPoints})
                  </span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                onAction({
                  type: state.phase === 'match_over' ? 'DEBERTS_REMATCH' : 'DEBERTS_NEXT_ROUND',
                  playerId: myPlayerId,
                })
              }
              className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              {state.phase === 'match_over' ? 'Новий матч' : 'Наступний раунд'}
            </button>
          </div>
        )}
      </div>

      {/* Player Hand */}
      <div className="shrink-0 flex items-center justify-center flex-wrap gap-1.5 pb-1">
        {(me?.hand ?? []).map((card) => {
          const playable = isMyTurn && isDebertsCardPlayable(card, me?.hand ?? [], state);
          return (
            <PlayingCard
              key={card.id}
              card={card}
              size="md"
              playable={playable}
              onClick={
                playable
                  ? () => {
                      triggerHaptic('light');
                      onAction({ type: 'DEBERTS_PLAY_CARD', playerId: myPlayerId, cardId: card.id });
                    }
                  : undefined
              }
            />
          );
        })}
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
