import React from 'react';
import { X, HelpCircle } from 'lucide-react';

interface RulesModalProps {
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="w-full max-w-md max-h-[85dvh] flex flex-col rounded-2xl bg-[#0b2919] border border-emerald-400/30 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-sky-400" />
            <h3 className="font-bold text-white">Правила: Карасьовий Брідж</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3 text-xs text-emerald-100/90 leading-relaxed">
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-1">
            <div className="font-bold text-amber-300">Базовий хід і серії</div>
            <p>• Кладіть карту в масть або номінал верхньої карти на столі.</p>
            <p>• Можна скинути 2–4 карти одного номіналу за раз (порядок обираєте ви, діє ефект останньої).</p>
            <p>• Якщо на столі поспіль лягло 4 карти одного номіналу — можна оголосити <b>«БРИДЖ!»</b> і миттєво виграти раунд.</p>
          </div>

          <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-1.5">
            <div className="font-bold text-amber-300">Спеціальні карти</div>
            <p><b className="text-white">6</b> — потрібно одразу покрити тією ж мастю або іншою 6 (тягнути доки не покриєте). Не можна класти останньою картою.</p>
            <p><b className="text-white">7</b> — наступний гравець бере 2 карти і пропускає хід.</p>
            <p><b className="text-white">8</b> — наступний бере 1 карту і ходить.</p>
            <p><b className="text-white">J (Валет)</b> — на будь-що (крім незакритої 6), замовляєте масть.</p>
            <p><b className="text-white">K♠ (Король пік)</b> — наступний бере 4 карти і пропускає хід.</p>
            <p><b className="text-white">A (Туз)</b> — наступний пропускає хід (N тузів = N пропусків).</p>
          </div>

          <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-1">
            <div className="font-bold text-amber-300">Очки (гра до 125)</div>
            <p>• 6–9 = <b>0</b> | Q = <b>3</b> | K = <b>4</b> | 10 = <b>10</b> | A = <b>11</b> | J = <b>20</b> | K♠ = <b>40</b></p>
            <p>• Якщо колоду перетасовували зі скиду — очки раунду множаться на кількість перетасовок (2 рази = <b>2x</b>).</p>
            <p>• Фініш Валетом: <b>-20 очок</b> за кожного Валета (мінімум <b>0</b> очок).</p>
            <p>• Рівно <b>125 очок</b> — рахунок скидається до <b>0</b>!</p>
            <p>• <b>126+ очок</b> — гравець вибуває, решта продовжують до останнього переможця.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
