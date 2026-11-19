import React from 'react';
import { ScrollText, X } from 'lucide-react';
import type { GameLogEntry } from '../shared/types';

interface LogsModalProps {
  logs: GameLogEntry[];
  onClose: () => void;
}

export const LogsModal: React.FC<LogsModalProps> = ({ logs, onClose }) => {
  const reversed = [...logs].reverse();
  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="w-full max-w-md max-h-[80dvh] flex flex-col rounded-2xl bg-[#0b2919] border border-emerald-400/35 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-amber-300" />
            <h3 className="font-bold text-white text-sm">Історія ходів</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 overflow-y-auto space-y-1.5 text-xs">
          {reversed.length === 0 ? (
            <div className="text-center text-white/50 py-6">Поки немає записів.</div>
          ) : (
            reversed.map((entry) => (
              <div
                key={entry.id}
                className={`px-3 py-2 rounded-xl border ${
                  entry.type === 'bridge'
                    ? 'bg-amber-400/15 border-amber-400/40 text-amber-200 font-semibold'
                    : entry.type === 'special'
                      ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-100'
                      : entry.type === 'warning'
                        ? 'bg-rose-500/15 border-rose-400/30 text-rose-200'
                        : 'bg-white/5 border-white/10 text-white/85'
                }`}
              >
                {entry.text}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
