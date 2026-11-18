import React, { useState } from 'react';
import { Coins, X } from 'lucide-react';
import type { BlackjackState, Card, HoldemCard } from '../shared/types';
import { PlayingCard } from './PlayingCard';
import { triggerHaptic } from '../utils/telegram';
import { playBridgeSound, playCardSound } from '../utils/sound';

interface BlackjackModalProps {
  chips: number;
  state: BlackjackState | null;
  onDeal: (bet: number) => void;
  onAction: (action: 'hit' | 'stand' | 'double') => void;
  onClose: () => void;
}

const BET_OPTIONS = [10, 25, 50, 100, 250];

function toDisplayCard(c: HoldemCard): Card {
  return { id: c.id, suit: c.suit, rank: c.rank as Card['rank'] };
}

export const BlackjackModal: React.FC<BlackjackModalProps> = ({
  chips,
  state,
  onDeal,
  onAction,
  onClose,
}) => {
  const [bet, setBet] = useState(25);

  const inHand = state?.phase === 'player_turn';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="w-full max-w-sm rounded-3xl felt-table border border-amber-400/40 p-4 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-black text-white text-base">🃏 Блекджек (21)</h3>
            <div className="text-[11px] text-amber-300 font-bold flex items-center gap-1">
              <Coins className="w-3 h-3" /> {chips} фішок
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Table */}
        <div className="rounded-2xl bg-black/35 border border-white/10 p-3 space-y-4">
          {/* Dealer */}
          <div className="text-center space-y-1.5">
            <div className="text-[11px] text-emerald-200/80 font-semibold">
              Дилер {state ? `(${state.dealerScore})` : ''}
            </div>
            <div className="flex items-center justify-center gap-1.5 min-h-[72px]">
              {state ? (
                <>
                  {state.dealerHand.map((c) => (
                    <PlayingCard key={c.id} card={toDisplayCard(c)} size="sm" />
                  ))}
                  {state.phase === 'player_turn' && <PlayingCard faceDown size="sm" />}
                </>
              ) : (
                <div className="text-xs text-white/40">Зробіть ставку для роздачі</div>
              )}
            </div>
          </div>

          {/* Outcome Banner */}
          {state?.phase === 'finished' && (
            <div
              className={`px-3 py-1.5 rounded-xl text-center text-xs font-extrabold border ${
                state.outcome === 'blackjack' || state.outcome === 'win'
                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                  : state.outcome === 'push'
                    ? 'bg-amber-400/20 border-amber-400 text-amber-200'
                    : 'bg-rose-500/25 border-rose-400 text-rose-200'
              }`}
            >
              {state.outcome === 'blackjack'
                ? `БЛЕКДЖЕК! Виграш +${state.payout} фішок!`
                : state.outcome === 'win'
                  ? `Перемога! +${state.payout} фішок`
                  : state.outcome === 'push'
                    ? `Нічия (повернення ${state.payout})`
                    : state.playerScore > 21
                      ? 'Перебір (>21)! Програш'
                      : 'Дилер переміг'}
            </div>
          )}

          {/* Player */}
          <div className="text-center space-y-1.5">
            <div className="flex items-center justify-center gap-1.5 min-h-[72px]">
              {state?.playerHand.map((c) => (
                <PlayingCard key={c.id} card={toDisplayCard(c)} size="sm" />
              ))}
            </div>
            <div className="text-[11px] text-white font-bold">
              Ви {state ? `(${state.playerScore})` : ''}
            </div>
          </div>
        </div>

        {/* Controls */}
        {inHand ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                playCardSound();
                onAction('hit');
              }}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs active:scale-95 transition"
            >
              Взяти (Hit)
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('medium');
                playBridgeSound();
                onAction('stand');
              }}
              className="flex-1 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs active:scale-95 transition"
            >
              Стоп (Stand)
            </button>
            {state.playerHand.length === 2 && chips >= state.bet && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('heavy');
                  playCardSound();
                  onAction('double');
                }}
                className="px-3 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-extrabold text-xs active:scale-95 transition"
              >
                2x
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-1">
              {BET_OPTIONS.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBet(b)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold ${
                    bet === b
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-white/10 text-white/80 hover:bg-white/20'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={chips < bet}
              onClick={() => {
                triggerHaptic('medium');
                playCardSound();
                onDeal(bet);
              }}
              className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-black text-sm shadow-lg active:scale-95 transition"
            >
              Роздати ({bet})
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
