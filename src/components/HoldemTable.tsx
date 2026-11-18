import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Coins,
  Eye,
  EyeOff,
  LogOut,
  RotateCcw,
  Volume2,
  VolumeX,
  MessageCircle,
} from 'lucide-react';
import type {
  Card,
  ChatMessage,
  HoldemAction,
  HoldemCard,
  HoldemPlayer,
  HoldemState,
} from '../shared/types';
import { evaluateBestHand } from '../shared/holdemEngine';
import { PlayingCard } from './PlayingCard';
import { ChatDrawer } from './ChatDrawer';
import { triggerHaptic } from '../utils/telegram';
import {
  isSoundEnabled,
  playBridgeSound,
  playCardSound,
  setSoundEnabled,
} from '../utils/sound';

interface HoldemTableProps {
  state: HoldemState;
  myPlayerId: string;
  isSandbox: boolean;
  roomCode?: string;
  chatMessages?: ChatMessage[];
  onSendChat?: (text: string) => void;
  onAction: (action: HoldemAction) => void;
  onLeave: () => void;
}

function asDisplayCard(c: HoldemCard): Card {
  return { id: c.id, suit: c.suit, rank: c.rank as Card['rank'] };
}

export const HoldemTable: React.FC<HoldemTableProps> = ({
  state,
  myPlayerId,
  isSandbox,
  roomCode,
  chatMessages = [],
  onSendChat,
  onAction,
  onLeave,
}) => {
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());
  const [sandboxRevealAll, setSandboxRevealAll] = useState(true);
  const [raiseAmount, setRaiseAmount] = useState(state.bigBlind * 2);
  const [showShowdownModal, setShowShowdownModal] = useState(false);
  const [flyingChips, setFlyingChips] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const prevStreetRef = useRef(state.street);

  const southIndex = useMemo(() => {
    if (isSandbox) return state.currentPlayerIndex;
    const idx = state.players.findIndex((p) => p.id === myPlayerId);
    return idx >= 0 ? idx : 0;
  }, [isSandbox, myPlayerId, state.currentPlayerIndex, state.players]);

  const southPlayer = state.players[southIndex];
  const activePlayer = state.players[state.currentPlayerIndex];
  const isMyTurn =
    state.street !== 'showdown' &&
    state.currentPlayerIndex === southIndex &&
    !southPlayer.folded &&
    !southPlayer.allIn;

  useEffect(() => {
    setRaiseAmount(state.currentMaxBet + state.minRaise);
  }, [state.currentMaxBet, state.minRaise, state.street]);

  useEffect(() => {
    if (state.street === 'showdown' && prevStreetRef.current !== 'showdown') {
      playBridgeSound();
      setFlyingChips(true);
      setShowShowdownModal(false);
      const timer = window.setTimeout(() => {
        setFlyingChips(false);
        setShowShowdownModal(true);
      }, 1350);
      prevStreetRef.current = state.street;
      return () => clearTimeout(timer);
    } else if (state.street !== 'showdown') {
      setShowShowdownModal(false);
      setFlyingChips(false);
      if (state.street !== prevStreetRef.current) {
        playCardSound();
      }
    }
    prevStreetRef.current = state.street;
  }, [state.street]);

  const opponents = useMemo(() => {
    const list: Array<{ player: HoldemPlayer; index: number }> = [];
    for (let offset = 1; offset < state.players.length; offset++) {
      const idx = (southIndex + offset) % state.players.length;
      list.push({ player: state.players[idx], index: idx });
    }
    return list;
  }, [southIndex, state.players]);

  const toCall = Math.min(
    southPlayer.chips,
    Math.max(0, state.currentMaxBet - southPlayer.currentBet),
  );

  const myBestHand = useMemo(() => {
    if (southPlayer.folded || southPlayer.hand.length < 2) return null;
    return evaluateBestHand([...southPlayer.hand, ...state.communityCards]);
  }, [southPlayer.folded, southPlayer.hand, state.communityCards]);

  const highlightedCardIds = useMemo(() => {
    if (!myBestHand || myBestHand.category < 1) return new Set<string>();
    return new Set(myBestHand.usedCardIds);
  }, [myBestHand]);

  const iWonShowdown =
    state.street === 'showdown' && state.winnerIds.includes(southPlayer.id);

  const latestLog = state.logs[state.logs.length - 1];

  return (
    <div className="h-full w-full felt-table flex flex-col justify-between overflow-hidden safe-top safe-bottom">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-3 py-2 bg-black/25 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onLeave}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/90"
          >
            <LogOut className="w-4 h-4" />
          </button>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Покер</span>
              {roomCode && (
                <span className="px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 text-[10px] font-extrabold">
                  {roomCode}
                </span>
              )}
              {isSandbox && (
                <span className="px-1.5 py-0.5 rounded bg-sky-400/20 text-sky-300 text-[10px] font-bold">
                  НАВЧАННЯ
                </span>
              )}
            </div>
            <div className="text-[10px] text-emerald-200/75">
              Блайнди: {state.smallBlind}/{state.bigBlind} • Вулиця: {state.street.toUpperCase()}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {roomCode && onSendChat && (
            <button
              type="button"
              onClick={() => setShowChat(true)}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-emerald-200"
              title="Чат кімнати"
            >
              <MessageCircle className="w-4 h-4" />
            </button>
          )}
          {isSandbox && (
            <button
              type="button"
              onClick={() => setSandboxRevealAll((v) => !v)}
              className={`p-1.5 rounded-xl border ${
                sandboxRevealAll
                  ? 'bg-sky-400/20 border-sky-400/40 text-sky-200'
                  : 'bg-white/10 border-white/10 text-white/75'
              }`}
            >
              {sandboxRevealAll ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              setSoundEnabled(next);
            }}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/85"
          >
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-white/45" />}
          </button>
        </div>
      </header>

      {/* Opponents */}
      <div className="px-2 pt-1.5 flex items-start justify-center gap-1.5 sm:gap-3 flex-wrap shrink-0">
        {opponents.map(({ player, index }) => {
          const isTurn = state.street !== 'showdown' && state.currentPlayerIndex === index;
          const showCards =
            (isSandbox && sandboxRevealAll) ||
            (state.street === 'showdown' && !player.folded);

          return (
            <div
              key={player.id}
              className={`flex flex-col items-center px-2.5 py-1.5 rounded-2xl border min-w-[88px] ${
                player.folded
                  ? 'bg-black/20 border-white/5 opacity-55'
                  : isTurn
                    ? 'bg-amber-400/15 border-amber-400 shadow-lg'
                    : 'bg-black/25 border-white/10'
              }`}
            >
              <div className="text-xs font-bold text-white flex items-center gap-1">
                <span className="truncate max-w-[85px]">{player.name}</span>
                {state.dealerIndex === index && (
                  <span className="text-[9px] px-1 rounded bg-white/15 text-amber-300">D</span>
                )}
              </div>
              <div className="text-[10px] text-amber-300 font-bold">
                🪙 {player.chips}
                {player.currentBet > 0 && (
                  <span className="text-emerald-200 ml-1">(+{player.currentBet})</span>
                )}
              </div>
              <div className="flex items-center justify-center -space-x-2 mt-1">
                {player.hand.map((c) => (
                  <PlayingCard
                    key={c.id}
                    card={showCards ? asDisplayCard(c) : undefined}
                    faceDown={!showCards}
                    size="xs"
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Center: Pot, Community Cards, Log */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-3 py-2 gap-3 min-h-0">
        <div className="relative flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-200 text-sm font-extrabold">
          <Coins className="w-4 h-4 text-amber-300" />
          Банк: {state.pot}

          {/* Flying chips animation toward winner */}
          {flyingChips &&
            [0, 1, 2, 3, 4, 5].map((i) => (
              <motion.span
                key={i}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x: (i - 2.5) * 18,
                  y: iWonShowdown ? 170 : -150,
                  opacity: 0,
                  scale: 0.7,
                }}
                transition={{ duration: 1.05, delay: i * 0.08, ease: 'easeInOut' }}
                className="absolute left-1/2 top-1/2 text-base pointer-events-none"
              >
                🪙
              </motion.span>
            ))}
        </div>

        {/* 5 Community Cards */}
        <div className="flex items-center justify-center gap-1.5 sm:gap-2">
          {[0, 1, 2, 3, 4].map((slot) => {
            const card = state.communityCards[slot];
            if (!card) {
              return (
                <div
                  key={slot}
                  className="w-12 h-[68px] sm:w-14 sm:h-[80px] rounded-lg border border-dashed border-white/20 bg-black/15"
                />
              );
            }
            const isCombo = highlightedCardIds.has(card.id);
            return (
              <PlayingCard
                key={card.id}
                card={asDisplayCard(card)}
                size="sm"
                playable={isCombo}
              />
            );
          })}
        </div>

        {state.street !== 'showdown' && (
          <div className="text-xs font-bold text-amber-200">
            {isMyTurn ? 'Твій хід!' : `Хід: ${activePlayer?.name}`}
          </div>
        )}

        {latestLog && (
          <div className="px-3 py-1 rounded-xl bg-black/35 border border-white/10 text-xs text-white/90 text-center max-w-md">
            {latestLog.text}
          </div>
        )}
      </div>

      {/* Bottom: Player Hand + Poker Controls */}
      <div className="px-3 pt-1 pb-3 bg-gradient-to-t from-black/60 via-black/35 to-transparent shrink-0 space-y-2">
        <div className="max-w-md mx-auto flex items-center justify-between text-xs">
          <div className="font-bold text-white">
            {southPlayer.name} {state.dealerIndex === southIndex ? '(D)' : ''}
            <span className="ml-2 text-amber-300">🪙 {southPlayer.chips}</span>
          </div>
          {myBestHand && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 border border-emerald-400/35 text-emerald-200 text-[11px] font-bold">
              {myBestHand.name}
            </span>
          )}
        </div>

        {/* Hole Cards */}
        <div className="flex items-center justify-center gap-2">
          {southPlayer.hand.map((c) => (
            <PlayingCard
              key={c.id}
              card={asDisplayCard(c)}
              size="md"
              playable={highlightedCardIds.has(c.id)}
            />
          ))}
        </div>

        {/* Betting Buttons */}
        {isMyTurn && (
          <div className="max-w-md mx-auto space-y-2 pt-1">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  onAction({ type: 'HOLDEM_FOLD', playerId: southPlayer.id });
                }}
                className="px-3 py-2.5 rounded-xl bg-rose-500/80 hover:bg-rose-500 text-white text-xs font-bold active:scale-95 transition"
              >
                Fold
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  onAction({ type: 'HOLDEM_CHECK_CALL', playerId: southPlayer.id });
                }}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold active:scale-95 transition"
              >
                {toCall === 0 ? 'Check' : `Call ${toCall}`}
              </button>
              {southPlayer.chips > toCall && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('medium');
                    onAction({
                      type: 'HOLDEM_RAISE',
                      playerId: southPlayer.id,
                      amount: raiseAmount,
                    });
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold active:scale-95 transition"
                >
                  Raise {raiseAmount}
                </button>
              )}
              {southPlayer.chips > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('heavy');
                    onAction({ type: 'HOLDEM_ALL_IN', playerId: southPlayer.id });
                  }}
                  className="px-3 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white text-xs font-extrabold active:scale-95 transition"
                >
                  All-In
                </button>
              )}
            </div>
            {southPlayer.chips > toCall && (
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={state.currentMaxBet + state.minRaise}
                  max={southPlayer.currentBet + southPlayer.chips}
                  step={10}
                  value={Math.min(
                    southPlayer.currentBet + southPlayer.chips,
                    Math.max(state.currentMaxBet + state.minRaise, raiseAmount),
                  )}
                  onChange={(e) => setRaiseAmount(Number(e.target.value))}
                  className="flex-1 accent-amber-400"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Showdown Modal (shown after flying chips animation) */}
      {state.street === 'showdown' && showShowdownModal && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-xs rounded-3xl bg-[#0c2d1b] border border-amber-400/40 p-5 shadow-2xl text-center space-y-4"
          >
            <h2 className="text-xl font-black text-white">Роздача завершена!</h2>
            <div className="space-y-1">
              <div className="text-sm text-amber-300 font-bold">
                {state.winningHandName}
              </div>
              <div className="text-xs text-emerald-200">
                Переможець:{' '}
                <span className="font-bold text-white">
                  {state.winnerIds
                    .map((id) => state.players.find((p) => p.id === id)?.name)
                    .join(', ')}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onLeave}
                className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm"
              >
                У лобі
              </button>
              <button
                type="button"
                onClick={() =>
                  onAction({ type: 'HOLDEM_NEXT_HAND', playerId: southPlayer.id })
                }
                className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                Наступна
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {showChat && roomCode && onSendChat && (
        <ChatDrawer
          title={`Чат кімнати ${roomCode}`}
          myPlayerId={myPlayerId}
          messages={chatMessages}
          onSend={onSendChat}
          onClose={() => setShowChat(false)}
        />
      )}
    </div>
  );
};
