import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Coins, Sparkles, X, Zap } from 'lucide-react';
import type { SlotSpinOutcome, SlotSymbol } from '../shared/types';
import { triggerHaptic } from '../utils/telegram';
import { playBridgeSound, playCardSound, playSpecialSound } from '../utils/sound';

interface SlotModalProps {
  chips: number;
  karasykBrandingEnabled?: boolean;
  lastResult: SlotSpinOutcome | null;
  onSpin: (bet: number) => void;
  onBuyBonus: (bet: number) => void;
  onClose: () => void;
}

const BET_OPTIONS = [10, 25, 50, 100, 250];
const ALL_SYMBOLS: SlotSymbol[] = ['🍒', '🍋', '🍇', '🔔', '💎', '7️⃣', '🃏'];
const DEFAULT_GRID: SlotSymbol[][] = [
  ['🍒', '7️⃣', '💎'],
  ['🍋', '🃏', '🔔'],
  ['🍇', '💎', '🍒'],
  ['🔔', '7️⃣', '🍋'],
  ['🍒', '🍇', '💎'],
];

function randomSym(): SlotSymbol {
  return ALL_SYMBOLS[Math.floor(Math.random() * ALL_SYMBOLS.length)];
}

export const SlotModal: React.FC<SlotModalProps> = ({
  chips,
  karasykBrandingEnabled = true,
  lastResult,
  onSpin,
  onBuyBonus,
  onClose,
}) => {
  const [bet, setBet] = useState(10);
  const [spinningCols, setSpinningCols] = useState<boolean[]>([
    false,
    false,
    false,
    false,
    false,
  ]);
  const [displayGrid, setDisplayGrid] = useState<SlotSymbol[][]>(
    () => lastResult?.grid ?? DEFAULT_GRID,
  );
  const [settledResult, setSettledResult] = useState<SlotSpinOutcome | null>(lastResult);
  const [freeSpinsLeft, setFreeSpinsLeft] = useState(lastResult?.freeSpinsLeft ?? 0);

  const isAnySpinning = spinningCols.some(Boolean);
  const spinColsRef = useRef(spinningCols);
  spinColsRef.current = spinningCols;

  // Cycle symbols rapidly for any column that is currently spinning
  useEffect(() => {
    if (!isAnySpinning) return;
    const id = window.setInterval(() => {
      setDisplayGrid((prev) =>
        prev.map((col, colIdx) =>
          spinColsRef.current[colIdx] ? [randomSym(), randomSym(), randomSym()] : col,
        ),
      );
    }, 65);
    return () => clearInterval(id);
  }, [isAnySpinning]);

  // When server result arrives, stop reels one-by-one left-to-right
  useEffect(() => {
    if (!lastResult) return;
    const timers: number[] = [];

    for (let col = 0; col < 5; col++) {
      const t = window.setTimeout(() => {
        setDisplayGrid((prev) =>
          prev.map((c, idx) => (idx === col ? lastResult.grid[col] : c)),
        );
        setSpinningCols((prev) => prev.map((s, idx) => (idx === col ? false : s)));
        playCardSound();

        if (col === 4) {
          setSettledResult(lastResult);
          setFreeSpinsLeft(lastResult.freeSpinsLeft);
          if (lastResult.freeSpinsAwarded > 0) {
            playBridgeSound();
          } else if (lastResult.win > 0) {
            playSpecialSound();
          }
        }
      }, 320 + col * 160);
      timers.push(t);
    }

    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [lastResult]);

  const bonusCost = bet * 50;

  const handleSpinClick = () => {
    if (isAnySpinning) return;
    if (freeSpinsLeft === 0 && chips < bet) return;
    triggerHaptic('medium');
    playCardSound();
    setSettledResult(null);
    setSpinningCols([true, true, true, true, true]);
    onSpin(bet);
  };

  const handleBuyBonusClick = () => {
    if (isAnySpinning || chips < bonusCost || freeSpinsLeft > 0) return;
    triggerHaptic('heavy');
    playSpecialSound();
    setSettledResult(null);
    setSpinningCols([true, true, true, true, true]);
    onBuyBonus(bet);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#17281e] to-[#081a10] border border-amber-400/45 p-4 shadow-2xl space-y-3.5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎰</span>
            <div>
              <h3 className="font-black text-white text-base leading-tight">
                {karasykBrandingEnabled ? 'Карась Слот' : 'Слот'}
              </h3>
              <div className="text-[11px] text-amber-300 font-bold flex items-center gap-1">
                <Coins className="w-3 h-3" /> {chips} фішок
              </div>
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

        {/* Free Spins Banner */}
        {freeSpinsLeft > 0 && (
          <div className="px-3 py-1.5 rounded-xl bg-amber-400/20 border border-amber-400/50 text-center text-xs font-extrabold text-amber-200 animate-pulse">
            🔥 БОНУС-РАУНД! Фріспінів: {freeSpinsLeft} (множник 2x–5x)
          </div>
        )}

        {/* 5x3 Reels */}
        <div className="rounded-2xl bg-black/60 border border-amber-400/30 p-2.5 overflow-hidden">
          <div className="grid grid-cols-5 gap-1.5">
            {displayGrid.map((col, colIdx) => {
              const colSpinning = spinningCols[colIdx];
              return (
                <div key={colIdx} className="space-y-1.5">
                  {col.map((sym, rowIdx) => (
                    <motion.div
                      key={`${colIdx}_${rowIdx}`}
                      animate={
                        colSpinning
                          ? { y: [0, 4, -4, 0], opacity: 0.75 }
                          : { y: 0, opacity: 1, scale: 1 }
                      }
                      transition={{ duration: 0.12 }}
                      className={`h-12 rounded-xl flex items-center justify-center text-2xl border ${
                        colSpinning
                          ? 'bg-white/10 border-amber-300/30 blur-[0.6px]'
                          : sym === '🃏'
                            ? 'bg-amber-400/20 border-amber-400/60'
                            : 'bg-white/5 border-white/10'
                      }`}
                    >
                      {sym}
                    </motion.div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Win Status */}
        <div className="h-7 flex items-center justify-center text-xs font-extrabold">
          {isAnySpinning ? (
            <span className="text-amber-300 animate-pulse">Крутимо барабани...</span>
          ) : settledResult ? (
            settledResult.win > 0 ? (
              <span className="text-emerald-300 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                Виграш: +{settledResult.win} фішок
                {settledResult.multiplier > 1 && ` (${settledResult.multiplier}x)`}
              </span>
            ) : (
              <span className="text-white/50">Спробуй ще! (3× 🃏 = 8 фріспінів)</span>
            )
          ) : (
            <span className="text-emerald-200/70">5 ліній • 3+ 🃏 дають бонус-фріспіни</span>
          )}
        </div>

        {/* Bet Selector */}
        <div className="space-y-1">
          <div className="text-[10px] text-emerald-200/75 text-center">Ставка за спін:</div>
          <div className="flex gap-1">
            {BET_OPTIONS.map((b) => (
              <button
                key={b}
                type="button"
                disabled={freeSpinsLeft > 0 || isAnySpinning}
                onClick={() => setBet(b)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                  bet === b
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-white/10 text-white/80 hover:bg-white/20 disabled:opacity-40'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        {/* Actions: Spin & Buy Bonus */}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isAnySpinning || chips < bonusCost || freeSpinsLeft > 0}
            onClick={handleBuyBonusClick}
            className="px-3 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-extrabold flex items-center gap-1 active:scale-95 transition"
            title="Гарантовані 3+ 🃏 (8 фріспінів з множниками 2x–5x)"
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            Бонус ({bonusCost})
          </button>
          <button
            type="button"
            disabled={isAnySpinning || (freeSpinsLeft === 0 && chips < bet)}
            onClick={handleSpinClick}
            className="flex-1 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-black text-sm shadow-lg active:scale-95 transition"
          >
            {freeSpinsLeft > 0 ? `ФРІСПІН (${freeSpinsLeft})` : `СПІН (${bet})`}
          </button>
        </div>
      </div>
    </div>
  );
};
