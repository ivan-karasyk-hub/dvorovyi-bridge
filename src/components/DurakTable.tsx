import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Eye,
  EyeOff,
  LogOut,
  RotateCcw,
  Shield,
  Swords,
  Volume2,
  VolumeX,
  ArrowRightLeft,
  MessageCircle,
  ScrollText,
} from 'lucide-react';
import type { Card, ChatMessage, DurakAction, DurakPlayer, DurakState } from '../shared/types';
import {
  SUIT_NAMES_UK,
  SUIT_SYMBOLS,
} from '../shared/gameEngine';
import {
  canDefendCard,
  canThrowCardInDurak,
  canTransferCardInDurak,
} from '../shared/durakEngine';
import { PlayingCard } from './PlayingCard';
import { ChatDrawer } from './ChatDrawer';
import { LogsModal } from './LogsModal';
import { triggerHaptic } from '../utils/telegram';
import {
  isSoundEnabled,
  playBridgeSound,
  playCardSound,
  playSpecialSound,
  setSoundEnabled,
} from '../utils/sound';

interface DurakTableProps {
  state: DurakState;
  myPlayerId: string;
  isSandbox: boolean;
  roomCode?: string;
  chatMessages?: ChatMessage[];
  onSendChat?: (text: string) => void;
  onAction: (action: DurakAction) => void;
  onLeave: () => void;
}

export const DurakTable: React.FC<DurakTableProps> = ({
  state,
  myPlayerId,
  isSandbox,
  roomCode,
  chatMessages = [],
  onSendChat,
  onAction,
  onLeave,
}) => {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());
  const [sandboxRevealAll, setSandboxRevealAll] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [lastReadChatLen, setLastReadChatLen] = useState(0);
  const unreadChatCount = showChat
    ? 0
    : chatMessages.slice(lastReadChatLen).filter((m) => m.senderId !== myPlayerId).length;
  useEffect(() => {
    if (showChat) {
      setLastReadChatLen(chatMessages.length);
    }
  }, [showChat, chatMessages.length]);
  const prevTableLenRef = useRef(state.table.length);
  const prevPhaseRef = useRef(state.phase);

  const southIndex = useMemo(() => {
    if (isSandbox) {
      // In training mode, show defender if there are undefended cards and defender isn't taking, else attacker
      const hasUndefended = state.table.some((p) => p.defense === null);
      if (hasUndefended && !state.defenderTaking) return state.defenderIndex;
      return state.attackerIndex;
    }
    const idx = state.players.findIndex((p) => p.id === myPlayerId);
    return idx >= 0 ? idx : 0;
  }, [isSandbox, myPlayerId, state.attackerIndex, state.defenderIndex, state.defenderTaking, state.players, state.table]);

  const southPlayer = state.players[southIndex];
  const isDefender = southIndex === state.defenderIndex;
  const isActiveParticipant = southPlayer.finishedOrder === null;

  useEffect(() => {
    setSelectedCardId(null);
  }, [state.table.length, state.defenderIndex, state.attackerIndex, state.phase]);

  useEffect(() => {
    if (state.phase === 'round_over' && prevPhaseRef.current !== 'round_over') {
      playBridgeSound();
    } else if (state.table.length > prevTableLenRef.current) {
      playCardSound();
    }
    prevTableLenRef.current = state.table.length;
    prevPhaseRef.current = state.phase;
  }, [state.table.length, state.phase]);

  const opponents = useMemo(() => {
    const list: Array<{ player: DurakPlayer; index: number }> = [];
    for (let offset = 1; offset < state.players.length; offset++) {
      const idx = (southIndex + offset) % state.players.length;
      list.push({ player: state.players[idx], index: idx });
    }
    return list;
  }, [southIndex, state.players]);

  const undefendedIndices = useMemo(
    () =>
      state.table
        .map((p, i) => (p.defense === null ? i : -1))
        .filter((i) => i >= 0),
    [state.table],
  );

  const selectedCard = useMemo(
    () => southPlayer.hand.find((c) => c.id === selectedCardId) ?? null,
    [southPlayer.hand, selectedCardId],
  );

  const canTransferSelected =
    selectedCard !== null && canTransferCardInDurak(selectedCard, southIndex, state);

  const handleHandCardClick = (card: Card) => {
    if (state.phase !== 'playing' || !isActiveParticipant) return;
    triggerHaptic('light');

    if (isDefender) {
      if (state.defenderTaking) return;
      // If card can beat exactly 1 undefended pair AND cannot transfer (or user taps again), defend right away
      const beatableIndices = undefendedIndices.filter((idx) =>
        canDefendCard(state.table[idx].attack, card, state.trumpSuit),
      );
      const canTransfer = canTransferCardInDurak(card, southIndex, state);

      if (beatableIndices.length === 1 && !canTransfer) {
        onAction({
          type: 'DEFEND',
          playerId: southPlayer.id,
          cardId: card.id,
          attackIndex: beatableIndices[0],
        });
        return;
      }

      setSelectedCardId((prev) => (prev === card.id ? null : card.id));
      return;
    }

    // Attacker / Thrower
    if (canThrowCardInDurak(card, southIndex, state)) {
      onAction({ type: 'ATTACK', playerId: southPlayer.id, cardId: card.id });
    }
  };

  const handleTableAttackClick = (attackIndex: number) => {
    if (!isDefender || !selectedCard || state.defenderTaking) return;
    const pair = state.table[attackIndex];
    if (!pair || pair.defense !== null) return;
    if (!canDefendCard(pair.attack, selectedCard, state.trumpSuit)) return;

    triggerHaptic('medium');
    onAction({
      type: 'DEFEND',
      playerId: southPlayer.id,
      cardId: selectedCard.id,
      attackIndex,
    });
    setSelectedCardId(null);
  };

  const handleTransfer = () => {
    if (!selectedCard || !canTransferSelected) return;
    triggerHaptic('medium');
    playSpecialSound();
    onAction({ type: 'TRANSFER', playerId: southPlayer.id, cardId: selectedCard.id });
    setSelectedCardId(null);
  };

  const canPassAttack =
    state.phase === 'playing' &&
    !isDefender &&
    isActiveParticipant &&
    state.table.length > 0 &&
    !state.passedPlayerIds.includes(southPlayer.id) &&
    (state.defenderTaking || undefendedIndices.length === 0);

  const canTakeCards =
    state.phase === 'playing' &&
    isDefender &&
    !state.defenderTaking &&
    state.table.length > 0;

  const isRedTrump = state.trumpSuit === 'hearts' || state.trumpSuit === 'diamonds';
  const latestLog = state.logs[state.logs.length - 1];

  return (
    <div className="h-full w-full felt-table flex flex-col justify-between overflow-hidden safe-top safe-bottom">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-3 py-2 bg-black/25 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onLeave}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 active:scale-95 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Дурак ({state.mode === 'perevodnoy' ? 'Перевідний' : 'Підкидний'})</span>
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
              Колода: {state.deck.length} • Відбій: {state.discardCount} • Козир:{' '}
              <span className={isRedTrump ? 'text-rose-300 font-bold' : 'text-white font-bold'}>
                {SUIT_SYMBOLS[state.trumpSuit]}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowLogs(true)}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-amber-200"
            title="Історія ходів"
          >
            <ScrollText className="w-4 h-4" />
          </button>
          {roomCode && onSendChat && (
            <button
              type="button"
              onClick={() => setShowChat(true)}
              className="relative p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-emerald-200"
              title="Чат кімнати"
            >
              <MessageCircle className="w-4 h-4" />
              {unreadChatCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow">
                  {unreadChatCount}
                </span>
              )}
            </button>
          )}
          {isSandbox && (
            <button
              type="button"
              onClick={() => setSandboxRevealAll((v) => !v)}
              className={`p-1.5 rounded-xl border transition ${
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
          const isAtt = index === state.attackerIndex;
          const isDef = index === state.defenderIndex;
          const showOpen = isSandbox && sandboxRevealAll;

          return (
            <div
              key={player.id}
              className={`flex flex-col items-center px-2.5 py-1.5 rounded-2xl border transition-all min-w-[84px] ${
                isDef
                  ? 'bg-rose-500/15 border-rose-400/60'
                  : isAtt
                    ? 'bg-amber-400/15 border-amber-400/60'
                    : 'bg-black/25 border-white/10'
              }`}
            >
              <div className="flex items-center gap-1 text-xs font-bold text-white">
                <span className="truncate max-w-[90px]">{player.name}</span>
                {isAtt && <Swords className="w-3 h-3 text-amber-300" />}
                {isDef && <Shield className="w-3 h-3 text-rose-300" />}
              </div>
              <div className="text-[10px] text-emerald-200/80 mb-1">
                {player.finishedOrder !== null ? (
                  <span className="text-emerald-300 font-bold">Вийшов #{player.finishedOrder}</span>
                ) : (
                  `${player.hand.length} карт`
                )}
              </div>
              {player.hand.length > 0 && (
                <div className="flex items-center justify-center -space-x-4">
                  {player.hand.slice(0, showOpen ? 8 : 5).map((card) => (
                    <PlayingCard
                      key={card.id}
                      card={showOpen ? card : undefined}
                      faceDown={!showOpen}
                      size="xs"
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Center Table: Status + Trump/Deck + Attack/Defense Pairs */}
      <div className="flex-1 flex flex-col items-center justify-center px-3 py-2 gap-2.5 min-h-0">
        {/* Role Banner */}
        <div
          className={`px-3.5 py-1 rounded-full text-xs font-extrabold border ${
            isDefender
              ? 'bg-rose-500/25 border-rose-400 text-rose-100'
              : southIndex === state.attackerIndex
                ? 'bg-amber-400 text-slate-950 border-amber-200'
                : 'bg-black/40 border-white/15 text-emerald-100'
          }`}
        >
          {isDefender
            ? state.defenderTaking
              ? 'Ви берете карти...'
              : 'Ви відбиваєтесь!'
            : southIndex === state.attackerIndex
              ? 'Ваш хід (атакуйте!)'
              : state.table.length > 0
                ? 'Можете підкинути або натиснути Бито'
                : `Ходить: ${state.players[state.attackerIndex].name}`}
        </div>

        {latestLog && (
          <div className="px-3 py-1 rounded-xl bg-black/35 border border-white/10 text-xs text-white/90 text-center max-w-md">
            {latestLog.text}
          </div>
        )}

        {/* Deck + Table Pairs */}
        <div className="w-full max-w-lg flex items-center justify-center gap-4 flex-wrap">
          {/* Deck & Trump */}
          {state.deck.length > 0 ? (
            <div className="relative flex items-center mr-2">
              {state.trumpCard && (
                <div className="-rotate-90 translate-x-3 opacity-95">
                  <PlayingCard card={state.trumpCard} size="sm" />
                </div>
              )}
              <div className="relative z-10">
                <PlayingCard faceDown size="sm" />
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-black/80 border border-white/20 text-[10px] font-bold text-white">
                  {state.deck.length}
                </span>
              </div>
            </div>
          ) : (
            <div className="px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-center">
              <div className="text-[10px] text-emerald-200/70">Козир</div>
              <div
                className={`text-2xl font-bold ${
                  isRedTrump ? 'text-rose-400' : 'text-white'
                }`}
              >
                {SUIT_SYMBOLS[state.trumpSuit]}
              </div>
              <div className="text-[9px] text-white/50">{SUIT_NAMES_UK[state.trumpSuit].split(' ')[0]}</div>
            </div>
          )}

          {/* Table Pairs */}
          {state.table.length === 0 ? (
            <div className="px-6 py-8 rounded-2xl border-2 border-dashed border-white/15 text-xs text-white/45">
              Стіл порожній
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2.5 flex-wrap">
              {state.table.map((pair, idx) => {
                const canBeatThis =
                  isDefender &&
                  selectedCard !== null &&
                  pair.defense === null &&
                  canDefendCard(pair.attack, selectedCard, state.trumpSuit);

                return (
                  <div key={pair.attack.id} className="relative">
                    <PlayingCard
                      card={pair.attack}
                      size="sm"
                      playable={canBeatThis}
                      onClick={canBeatThis ? () => handleTableAttackClick(idx) : undefined}
                    />
                    {pair.defense && (
                      <div className="absolute top-2.5 left-2.5 z-10">
                        <PlayingCard card={pair.defense} size="sm" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Controls + Hand */}
      <div className="px-2 sm:px-4 pt-1 pb-2 bg-gradient-to-t from-black/55 via-black/30 to-transparent shrink-0">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-2 mb-2 px-1">
          <div className="text-xs font-bold text-white truncate">
            {southPlayer.name}
            {southPlayer.finishedOrder !== null && ' (Вийшов)'}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {canTransferSelected && (
              <button
                type="button"
                onClick={handleTransfer}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-slate-950 text-xs font-extrabold active:scale-95 transition"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                Перевести
              </button>
            )}
            {canTakeCards && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  onAction({ type: 'TAKE_CARDS', playerId: southPlayer.id });
                }}
                className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold active:scale-95 transition"
              >
                Взяти карти
              </button>
            )}
            {canPassAttack && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  onAction({ type: 'PASS_ATTACK', playerId: southPlayer.id });
                }}
                className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold active:scale-95 transition"
              >
                {state.defenderTaking ? 'Завершити' : 'Бито'}
              </button>
            )}
          </div>
        </div>

        <div className="w-full overflow-x-auto no-scrollbar pt-4 pb-1">
          <div className="flex items-end justify-center min-w-max px-4 -space-x-3 sm:-space-x-2">
            {southPlayer.hand.map((card) => {
              const isSelected = selectedCardId === card.id;
              const playable = isDefender
                ? !state.defenderTaking &&
                  (undefendedIndices.some((idx) =>
                    canDefendCard(state.table[idx].attack, card, state.trumpSuit),
                  ) ||
                    canTransferCardInDurak(card, southIndex, state))
                : canThrowCardInDurak(card, southIndex, state);

              return (
                <PlayingCard
                  key={card.id}
                  card={card}
                  size="md"
                  selected={isSelected}
                  playable={playable}
                  onClick={() => handleHandCardClick(card)}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Round Over Modal */}
      {state.phase === 'round_over' && (
        <div className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-xs rounded-3xl bg-[#0c2d1b] border border-amber-400/40 p-5 shadow-2xl text-center space-y-4"
          >
            <h2 className="text-xl font-black text-white">Гру завершено!</h2>
            <p className="text-sm text-emerald-200">
              {state.loserId ? (
                <>
                  Дурак:{' '}
                  <span className="font-bold text-rose-300">
                    {state.players.find((p) => p.id === state.loserId)?.name}
                  </span>
                </>
              ) : (
                'Нічия!'
              )}
            </p>
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
                onClick={() => onAction({ type: 'NEW_DURAK_GAME', playerId: southPlayer.id })}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-extrabold text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                Ще раз
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
      {showLogs && <LogsModal logs={state.logs} onClose={() => setShowLogs(false)} />}
    </div>
  );
};
