import React from 'react';
import { motion } from 'framer-motion';
import type { Suit } from '../shared/types';
import { SUITS, SUIT_NAMES_UK, SUIT_SYMBOLS } from '../shared/gameEngine';

interface SuitPickerModalProps {
  onSelect: (suit: Suit) => void;
}

export const SuitPickerModal: React.FC<SuitPickerModalProps> = ({ onSelect }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-xs rounded-2xl bg-[#0e2f1d] border border-emerald-400/30 p-5 shadow-2xl text-center"
      >
        <h3 className="text-lg font-bold text-white mb-1">Валет! Оберіть масть</h3>
        <p className="text-xs text-emerald-200/80 mb-4">
          Наступний гравець повинен ходити в замовлену масть
        </p>

        <div className="grid grid-cols-2 gap-3">
          {SUITS.map((suit) => {
            const isRed = suit === 'hearts' || suit === 'diamonds';
            return (
              <button
                key={suit}
                type="button"
                onClick={() => onSelect(suit)}
                className="flex flex-col items-center justify-center py-4 rounded-xl bg-white hover:bg-emerald-50 active:scale-95 transition-all shadow-md"
              >
                <span className={`text-4xl leading-none ${isRed ? 'text-rose-600' : 'text-slate-900'}`}>
                  {SUIT_SYMBOLS[suit]}
                </span>
                <span className="mt-1.5 text-xs font-semibold text-slate-700">
                  {SUIT_NAMES_UK[suit].split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};
