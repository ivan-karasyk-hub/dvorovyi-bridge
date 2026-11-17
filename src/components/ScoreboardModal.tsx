import React from 'react';
import { X, Trophy, RotateCcw } from 'lucide-react';
import type { GameState } from '../shared/types';

interface ScoreboardModalProps {
  state: GameState;
  onClose: () => void;
}

export const ScoreboardModal: React.FC<ScoreboardModalProps> = ({ state, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="w-full max-w-md max-h-[85dvh] flex flex-col rounded-2xl bg-[#0b2919] border border-emerald-400/30 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white">Таблиця рахунку</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          {/* Current totals */}
          <div className="grid grid-cols-2 gap-2">
            {state.players.map((p) => {
              const isLoser = p.score >= 126;
              return (
                <div
                  key={p.id}
                  className={`p-3 rounded-xl border ${
                    isLoser
                      ? 'bg-rose-950/60 border-rose-400/50'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="text-xs text-emerald-200/80 truncate">{p.name}</div>
                  <div className="text-2xl font-extrabold text-white mt-0.5">
                    {p.score}{' '}
                    <span className="text-xs font-normal text-emerald-300/70">/ 125</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Round history */}
          {state.scoreHistory.length === 0 ? (
            <p className="text-center text-sm text-emerald-200/60 py-4">
              Ще немає завершених раундів
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/15 text-emerald-200/80">
                    <th className="py-2 pr-2">Р</th>
                    {state.players.map((p) => (
                      <th key={p.id} className="py-2 px-1.5 text-center truncate max-w-[70px]">
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {state.scoreHistory.map((entry) => (
                    <tr key={entry.round} className="border-b border-white/5">
                      <td className="py-2 pr-2 font-semibold text-emerald-300">
                        #{entry.round}
                        {entry.winReason === 'bridge' && (
                          <span className="ml-1 text-[10px] text-amber-300">Б!</span>
                        )}
                      </td>
                      {state.players.map((p) => {
                        const delta = entry.deltas[p.id] ?? 0;
                        const total = entry.totals[p.id] ?? 0;
                        const wasReset = entry.resetToZeroPlayerIds.includes(p.id);
                        return (
                          <td key={p.id} className="py-2 px-1.5 text-center">
                            <div className="font-bold text-white flex items-center justify-center gap-0.5">
                              {total}
                              {wasReset && (
                                <RotateCcw
                                  className="w-3 h-3 text-amber-400"
                                  aria-label="Скинуто з 125 до 0"
                                />
                              )}
                            </div>
                            <div
                              className={`text-[10px] ${
                                delta < 0
                                  ? 'text-emerald-400'
                                  : delta === 0
                                    ? 'text-white/40'
                                    : 'text-amber-300'
                              }`}
                            >
                              {delta > 0 ? `+${delta}` : delta}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="text-[11px] text-emerald-200/70 bg-black/25 rounded-xl p-3 space-y-1">
            <div>• Карти: 6–9 = 0, 10 = 10, Q = 3, K = 4, K♠ = 40, A = 11, J = 20</div>
            <div>• Фініш Валетом: -20 очок за кожного Валета в останньому ході</div>
            <div>• Рівно 125 очок: рахунок обнуляється до 0!</div>
            <div>• 126+ очок: поразка, гра завершується</div>
          </div>
        </div>
      </div>
    </div>
  );
};
