import React from 'react';
import { motion } from 'framer-motion';
import type { Card, Suit } from '../shared/types';
import { SUIT_SYMBOLS } from '../shared/gameEngine';

interface PlayingCardProps {
  card?: Card;
  faceDown?: boolean;
  selected?: boolean;
  selectionOrder?: number;
  playable?: boolean;
  isDrawnHighlight?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<PlayingCardProps['size']>, string> = {
  xs: 'w-8 h-12 rounded-md text-[10px]',
  sm: 'w-12 h-[68px] rounded-lg text-xs',
  md: 'w-16 h-[92px] sm:w-[74px] sm:h-[106px] rounded-xl text-sm',
  lg: 'w-[72px] h-[104px] sm:w-20 sm:h-[116px] rounded-xl text-base',
};

function SuitIcon({ suit, className = '' }: { suit: Suit; className?: string }) {
  const symbol = SUIT_SYMBOLS[suit];
  const isRed = suit === 'hearts' || suit === 'diamonds';
  return (
    <span className={`${isRed ? 'text-rose-600' : 'text-slate-900'} ${className}`}>
      {symbol}
    </span>
  );
}

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  faceDown = false,
  selected = false,
  selectionOrder,
  playable = false,
  isDrawnHighlight = false,
  size = 'md',
  onClick,
  className = '',
}) => {
  const sizeCls = SIZE_CLASSES[size];

  if (faceDown || !card) {
    return (
      <motion.div
        layout
        onClick={onClick}
        className={`${sizeCls} relative bg-gradient-to-br from-emerald-800 via-emerald-900 to-slate-900 border-2 border-white/80 shadow-md flex items-center justify-center overflow-hidden ${
          onClick ? 'cursor-pointer active:scale-95 transition-transform' : ''
        } ${className}`}
      >
        <div className="w-[82%] h-[84%] rounded-md border border-amber-300/40 bg-[radial-gradient(#fbbf24_1px,transparent_1px)] [background-size:6px_6px] opacity-60" />
      </motion.div>
    );
  }

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const isKingOfSpades = card.rank === 'K' && card.suit === 'spades';

  return (
    <motion.button
      type="button"
      layout
      initial={{ scale: 0.88, opacity: 0, y: -12 }}
      animate={{
        scale: selected ? 1.04 : 1,
        opacity: 1,
        y: selected ? -16 : 0,
      }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      onClick={onClick}
      disabled={!onClick}
      className={`${sizeCls} relative bg-white border shadow-lg flex flex-col justify-between p-1 sm:p-1.5 select-none text-left transition-shadow ${
        selected
          ? 'border-amber-400 ring-2 ring-amber-400 shadow-amber-400/30 z-20'
          : isDrawnHighlight
            ? 'border-sky-400 ring-2 ring-sky-400 shadow-sky-400/40'
            : playable
              ? 'border-emerald-400/90 ring-1 ring-emerald-300/70'
              : 'border-slate-300'
      } ${onClick ? 'cursor-pointer' : 'cursor-default'} ${className}`}
    >
      {/* Top-left rank & suit */}
      <div
        className={`flex flex-col items-center leading-none font-bold ${
          isRed ? 'text-rose-600' : 'text-slate-900'
        }`}
      >
        <span>{card.rank}</span>
        <SuitIcon suit={card.suit} className="text-[0.85em]" />
      </div>

      {/* Center emblem */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {isKingOfSpades ? (
          <div className="flex flex-col items-center">
            <SuitIcon suit="spades" className="text-2xl sm:text-3xl drop-shadow-sm" />
            <span className="text-[9px] font-extrabold tracking-tighter text-amber-600 bg-amber-100 px-1 rounded">
              40
            </span>
          </div>
        ) : (
          <SuitIcon
            suit={card.suit}
            className={size === 'xs' ? 'text-sm' : size === 'sm' ? 'text-xl' : 'text-2xl sm:text-3xl'}
          />
        )}
      </div>

      {/* Bottom-right rank & suit (inverted) */}
      <div
        className={`flex flex-col items-center leading-none font-bold self-end rotate-180 ${
          isRed ? 'text-rose-600' : 'text-slate-900'
        }`}
      >
        <span>{card.rank}</span>
        <SuitIcon suit={card.suit} className="text-[0.85em]" />
      </div>

      {/* Selection order badge for series */}
      {selectionOrder !== undefined && (
        <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-amber-400 text-slate-950 text-[11px] font-extrabold flex items-center justify-center shadow border border-white">
          {selectionOrder}
        </span>
      )}
    </motion.button>
  );
};
