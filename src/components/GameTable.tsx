import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Eye,
  EyeOff,
  LogOut,
  Trophy,
  Sparkles,
  ArrowRight,
  Layers,
} from 'lucide-react';
import type { Card, GameAction, GameState, Player, Suit } from '../shared/types';
import {
  SUIT_NAMES_UK,
  SUIT_SYMBOLS,
  isCardPlayable,
  validateSeriesPlay,
} from '../shared/gameEngine';
import { PlayingCard } from './PlayingCard';
import { SuitPickerModal } from './SuitPickerModal';
import { ScoreboardModal } from './ScoreboardModal';
import { triggerHaptic } from '../utils/telegram';

interface GameTableProps {
  state: GameState;
  myPlayerId: string;
  isSandbox: boolean;
  roomCode?: string;
  onAction: (action: GameAction) => void;
  onLeave: () => void;
}

export const GameTable: React.FC<GameTableProps> = ({
  state,
  myPlayerId,
  isSandbox,
  roomCode,
  onAction,
  onLeave,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [sandboxRevealAll, setSandboxRevealAll] = useState(true);

  // In Sandbox mode, South seat follows the active player so you can test every turn
  const southIndex = useMemo(() => {
    if (isSandbox) return state.currentPlayerIndex;
    const idx = state.players.findIndex((p) => p.id === myPlayerId);
    return idx >= 0 ? idx : 0;
  }, [isSandbox, myPlayerId, state.currentPlayerIndex, state.players]);

  const southPlayer = state.players[southIndex];
  const isMyTurn = state.currentPlayerIndex === southIndex;

  // Clear selection whenever turn or phase changes
  useEffect(() => {
    setSelectedIds([]);
  }, [state.currentPlayerIndex, state.phase, state.round, state.discardPile.length]);

  // Arrange opponents clockwise starting after southIndex
  const opponents = useMemo(() => {
    const list: Array<{ player: Player; index: number }> = [];
    for (let offset = 1; offset < state.players.length; offset++) {
      const idx = (southIndex + offset) % state.players.length;
      list.push({ player: state.players[idx], index: idx });
    }
    return list;
  }, [southIndex, state.players]);

  const topDiscard = state.discardPile[state.discardPile.length - 1];
  const latestLog = state.logs[state.logs.length - 1];
  const prevLog = state.logs.length > 1 ? state.logs[state.logs.length - 2] : null;

  const seriesValidation = useMemo(() => {
    if (!isMyTurn || selectedIds.length === 0) return null;
    return validateSeriesPlay(selectedIds, southPlayer.hand, state);
  }, [isMyTurn, selectedIds, southPlayer.hand, state]);

  const handleCardClick = (card: Card) => {
    if (!isMyTurn) return;
    if (state.phase !== 'playing' && state.phase !== 'must_cover_six') return;

    triggerHaptic('light');
    setSelectedIds((prev) => {
      if (prev.includes(card.id)) {
        return prev.filter((id) => id !== card.id);
      }
      if (prev.length === 0) {
        return [card.id];
      }
      const firstSelected = southPlayer.hand.find((c) => c.id === prev[0]);
      if (firstSelected && firstSelected.rank === card.rank && prev.length < 4) {
        return [...prev, card.id];
      }
      // Different rank -> start new selection
      return [card.id];
    });
  };

  const handlePlaySelected = () => {
    if (!seriesValidation?.valid) return;
    triggerHaptic('medium');
    onAction({
      type: 'PLAY_CARDS',
      playerId: southPlayer.id,
      cardIds: selectedIds,
    });
    setSelectedIds([]);
  };

  const handleDraw = () => {
    if (!isMyTurn) return;
    triggerHaptic('light');
    onAction({ type: 'DRAW_CARD', playerId: southPlayer.id });
  };

  const handlePass = () => {
    if (!isMyTurn) return;
    triggerHaptic('light');
    onAction({ type: 'PASS_TURN', playerId: southPlayer.id });
  };

  const handleChooseSuit = (suit: Suit) => {
    triggerHaptic('medium');
    onAction({ type: 'CHOOSE_SUIT', playerId: southPlayer.id, suit });
  };

  const canDraw =
    isMyTurn &&
    ((state.phase === 'playing' && !state.hasDrawnThisTurn) ||
      state.phase === 'must_cover_six');

  const canPass = isMyTurn && state.phase === 'playing' && state.hasDrawnThisTurn;

  const isRedSuit = state.activeSuit === 'hearts' || state.activeSuit === 'diamonds';

  return (
    <div className="h-full w-full felt-table flex flex-col justify-between overflow-hidden safe-top safe-bottom">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-3 py-2 bg-black/25 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onLeave}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 active:scale-95 transition"
            title="Вийти в лобі"
          >
            <LogOut className="w-4 h-4" />
          </button>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Раунд {state.round}</span>
              {roomCode && (
                <span className="px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 text-[10px] font-extrabold tracking-wider">
                  {roomCode}
                </span>
              )}
              {isSandbox && (
                <span className="px-1.5 py-0.5 rounded bg-sky-400/20 text-sky-300 text-[10px] font-bold">
                  ПІСОЧНИЦЯ
                </span>
              )}
            </div>
            <div className="text-[10px] text-emerald-200/75">
              Колода: {state.deck.length} • Скид: {state.discardPile.length}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isSandbox && (
            <button
              type="button"
              onClick={() => setSandboxRevealAll((v) => !v)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
                sandboxRevealAll
                  ? 'bg-sky-400/20 border-sky-400/40 text-sky-200'
                  : 'bg-white/10 border-white/10 text-white/75'
              }`}
            >
              {sandboxRevealAll ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Карти</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowScoreboard(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/30 text-amber-200 text-xs font-bold active:scale-95 transition"
          >
            <Trophy className="w-3.5 h-3.5" />
            Рахунок
          </button>
        </div>
      </header>

      {/* Opponents Area */}
      <div className="px-2 sm:px-3 pt-1.5 flex items-start justify-center gap-1.5 sm:gap-3 flex-wrap shrink-0">
        {opponents.map(({ player, index }) => {
          const isTurn = state.currentPlayerIndex === index;
          const isDealer = state.dealerIndex === index;
          const showOpen = isSandbox && sandboxRevealAll;
          const compact = opponents.length >= 4;

          return (
            <div
              key={player.id}
              className={`flex flex-col items-center rounded-2xl border transition-all ${
                compact
                  ? 'px-2 py-1 min-w-[78px] max-w-[120px]'
                  : 'px-2.5 py-1.5 min-w-[92px] max-w-[160px]'
              } ${
                isTurn
                  ? 'bg-amber-400/15 border-amber-400 shadow-lg shadow-amber-500/10'
                  : 'bg-black/25 border-white/10'
              }`}
            >
              <div className="flex items-center gap-1 text-xs font-bold text-white max-w-full">
                {!player.connected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                )}
                <span className="truncate">{player.name}</span>
                {isDealer && (
                  <span
                    className="text-[9px] px-1 rounded bg-white/15 text-emerald-200"
                    title="Здаючий"
                  >
                    D
                  </span>
                )}
              </div>
              <div className="text-[10px] text-emerald-200/80 mb-1">
                {player.score} оч. • {player.hand.length} карт
              </div>

              {/* Opponent cards (face down or open in Sandbox) */}
              <div className="flex items-center justify-center -space-x-4 sm:-space-x-3">
                {player.hand.slice(0, showOpen ? 8 : 5).map((card) => (
                  <PlayingCard
                    key={card.id}
                    card={showOpen ? card : undefined}
                    faceDown={!showOpen}
                    size="xs"
                  />
                ))}
                {player.hand.length > (showOpen ? 8 : 5) && (
                  <span className="pl-5 text-[10px] font-bold text-emerald-200">
                    +{player.hand.length - (showOpen ? 8 : 5)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Center Table: Event Log + Deck & Discard + Active Suit */}
      <div className="flex-1 flex flex-col items-center justify-center px-3 py-2 gap-3 min-h-0">
        {/* Event Log Banner */}
        <div className="w-full max-w-md space-y-1">
          {latestLog && (
            <motion.div
              key={latestLog.id}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`px-3 py-1.5 rounded-xl text-center text-xs font-semibold border backdrop-blur-sm ${
                latestLog.type === 'bridge'
                  ? 'bg-amber-400/25 border-amber-300 text-amber-200'
                  : latestLog.type === 'special'
                    ? 'bg-emerald-400/20 border-emerald-300/40 text-emerald-100'
                    : latestLog.type === 'warning'
                      ? 'bg-rose-500/20 border-rose-400/40 text-rose-200'
                      : 'bg-black/35 border-white/10 text-white/90'
              }`}
            >
              {latestLog.text}
            </motion.div>
          )}
          {prevLog && (
            <div className="text-[10px] text-center text-emerald-200/55 truncate px-4">
              {prevLog.text}
            </div>
          )}
        </div>

        {/* Center Piles */}
        <div className="flex items-center justify-center gap-6 sm:gap-10">
          {/* Deck */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="relative">
              {state.deck.length > 0 ? (
                <PlayingCard
                  faceDown
                  size="lg"
                  onClick={canDraw ? handleDraw : undefined}
                  className={
                    canDraw ? 'ring-2 ring-amber-400/80 shadow-amber-400/20' : 'opacity-85'
                  }
                />
              ) : (
                <button
                  type="button"
                  disabled={!canDraw}
                  onClick={handleDraw}
                  className="w-[72px] h-[104px] sm:w-20 sm:h-[116px] rounded-xl border-2 border-dashed border-white/25 flex flex-col items-center justify-center text-[10px] text-white/60"
                >
                  <Layers className="w-5 h-5 mb-1 opacity-60" />
                  Порожньо
                </button>
              )}
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-black/75 border border-white/15 text-[10px] font-bold text-white">
                {state.deck.length}
              </span>
            </div>
            <span className="text-[10px] text-emerald-200/75 mt-1">
              {canDraw ? 'Натисни взяти' : 'Колода'}
            </span>
          </div>

          {/* Discard Pile */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="relative">
              <AnimatePresence mode="popLayout">
                {topDiscard && (
                  <PlayingCard key={topDiscard.id} card={topDiscard} size="lg" />
                )}
              </AnimatePresence>

              {/* Active / Ordered Suit Badge */}
              <div
                className="absolute -top-2.5 -right-2.5 w-8 h-8 rounded-full bg-white shadow-lg border-2 border-emerald-500 flex items-center justify-center text-lg font-bold"
                title={`Активна масть: ${SUIT_NAMES_UK[state.activeSuit]}`}
              >
                <span className={isRedSuit ? 'text-rose-600' : 'text-slate-900'}>
                  {SUIT_SYMBOLS[state.activeSuit]}
                </span>
              </div>
            </div>
            <span className="text-[10px] text-emerald-200/85 mt-1 font-medium">
              {state.orderedSuit
                ? `Замовлено: ${SUIT_NAMES_UK[state.orderedSuit]}`
                : state.phase === 'must_cover_six'
                  ? `Покрий 6 (${SUIT_SYMBOLS[state.activeSuit]} або 6)`
                  : `Масть: ${SUIT_SYMBOLS[state.activeSuit]}`}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Area: Action Controls + South Player Hand */}
      <div className="px-2 sm:px-4 pt-1 pb-2 bg-gradient-to-t from-black/55 via-black/30 to-transparent shrink-0">
        {/* Turn status & Action Buttons */}
        <div className="max-w-lg mx-auto flex items-center justify-between gap-2 mb-2 px-1">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                isMyTurn ? 'bg-amber-400 animate-pulse' : 'bg-white/30'
              }`}
            />
            <div className="truncate">
              <span className="text-xs font-bold text-white">
                {southPlayer.name}
                {state.dealerIndex === southIndex ? ' (D)' : ''}
              </span>
              <span className="ml-2 text-[11px] text-emerald-200/80">
                {southPlayer.score} оч.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {canDraw && (
              <button
                type="button"
                onClick={handleDraw}
                className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-bold active:scale-95 transition"
              >
                {state.phase === 'must_cover_six' ? 'Тягнути на 6' : 'Взяти карту'}
              </button>
            )}

            {canPass && (
              <button
                type="button"
                onClick={handlePass}
                className="px-3 py-1.5 rounded-xl bg-rose-500/80 hover:bg-rose-500 text-white text-xs font-bold active:scale-95 transition"
              >
                Пас
              </button>
            )}

            {selectedIds.length > 0 && isMyTurn && (
              <button
                type="button"
                disabled={!seriesValidation?.valid}
                onClick={handlePlaySelected}
                className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 text-xs font-extrabold shadow-lg active:scale-95 transition"
              >
                Походити ({selectedIds.length})
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Validation hint if invalid series selected */}
        {selectedIds.length > 0 && seriesValidation && !seriesValidation.valid && (
          <div className="text-center text-[11px] text-rose-300 mb-1">
            {seriesValidation.reason}
          </div>
        )}

        {/* Player's Hand */}
        <div className="w-full overflow-x-auto no-scrollbar pt-5 pb-1">
          <div className="flex items-end justify-center min-w-max px-4 -space-x-3 sm:-space-x-2">
            {southPlayer.hand.map((card) => {
              const selIdx = selectedIds.indexOf(card.id);
              const isSelected = selIdx >= 0;
              const canPlaySingle =
                isMyTurn &&
                isCardPlayable(card, state) &&
                !(card.rank === '6' && southPlayer.hand.length === 1);

              return (
                <PlayingCard
                  key={card.id}
                  card={card}
                  size="md"
                  selected={isSelected}
                  selectionOrder={selectedIds.length > 1 && isSelected ? selIdx + 1 : undefined}
                  playable={canPlaySingle}
                  isDrawnHighlight={state.drawnCardId === card.id}
                  onClick={() => handleCardClick(card)}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Jack Suit Picker */}
      {state.phase === 'choosing_suit' && isMyTurn && (
        <SuitPickerModal onSelect={handleChooseSuit} />
      )}

      {/* Scoreboard Modal */}
      {showScoreboard && (
        <ScoreboardModal state={state} onClose={() => setShowScoreboard(false)} />
      )}

      {/* Round Over / Match Over Modal */}
      {(state.phase === 'round_over' || state.phase === 'match_over') && (
        <div className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm rounded-3xl bg-[#0c2d1b] border border-amber-400/40 p-5 shadow-2xl text-center space-y-4"
          >
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-400/20 text-amber-300 mx-auto">
              {state.roundWinReason === 'bridge' ? (
                <Sparkles className="w-6 h-6" />
              ) : (
                <Trophy className="w-6 h-6" />
              )}
            </div>

            <div>
              <h2 className="text-xl font-black text-white">
                {state.phase === 'match_over'
                  ? 'Гру завершено!'
                  : state.roundWinReason === 'bridge'
                    ? 'БРИДЖ!'
                    : `Раунд ${state.round} завершено`}
              </h2>
              <p className="text-sm text-emerald-200 mt-1">
                Переможець раунду:{' '}
                <span className="font-bold text-amber-300">
                  {state.players.find((p) => p.id === state.roundWinnerId)?.name}
                </span>
              </p>
            </div>

            <div className="space-y-1.5 text-left">
              {state.players.map((p) => {
                const lastEntry = state.scoreHistory[state.scoreHistory.length - 1];
                const delta = lastEntry?.deltas[p.id] ?? 0;
                const wasReset = lastEntry?.resetToZeroPlayerIds.includes(p.id);
                const isLoser = p.score >= 126;

                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl border ${
                      isLoser
                        ? 'bg-rose-950/60 border-rose-400/40'
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <span className="text-sm font-semibold text-white">
                      {p.name}
                      {isLoser && ' (Програв)'}
                    </span>
                    <div className="text-right">
                      <span className="text-sm font-extrabold text-white">{p.score} оч.</span>
                      <span
                        className={`ml-2 text-xs font-semibold ${
                          delta < 0 ? 'text-emerald-400' : 'text-amber-300'
                        }`}
                      >
                        ({delta > 0 ? `+${delta}` : delta}
                        {wasReset ? ' → 0!' : ''})
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {state.phase === 'round_over' ? (
              <button
                type="button"
                onClick={() => onAction({ type: 'START_NEXT_ROUND', playerId: southPlayer.id })}
                className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-sm shadow-lg active:scale-95 transition"
              >
                Наступний раунд
              </button>
            ) : (
              <button
                type="button"
                onClick={onLeave}
                className="w-full py-3 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-extrabold text-sm shadow-lg active:scale-95 transition"
              >
                Повернутися в лобі
              </button>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
};
