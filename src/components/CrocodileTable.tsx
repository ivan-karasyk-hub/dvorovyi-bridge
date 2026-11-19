import React, { useEffect, useRef, useState } from 'react';
import { Eraser, LogOut, MessageCircle, RefreshCw, RotateCcw, Send, Trash2 } from 'lucide-react';
import type { ChatMessage, CrocodileAction, CrocodileState, CrocodileStroke } from '../shared/types';
import { ChatDrawer } from './ChatDrawer';

interface CrocodileTableProps {
  state: CrocodileState;
  myPlayerId: string;
  roomCode: string;
  chatMessages: ChatMessage[];
  onSendChat: (text: string) => void;
  onAction: (action: CrocodileAction) => void;
  onLeave: () => void;
}

const COLORS = ['#ffffff', '#000000', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#a855f7'];

export const CrocodileTable: React.FC<CrocodileTableProps> = ({
  state,
  myPlayerId,
  roomCode,
  chatMessages,
  onSendChat,
  onAction,
  onLeave,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(4);
  const [guessText, setGuessText] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [lastReadChatLen, setLastReadChatLen] = useState(0);

  useEffect(() => {
    if (chatOpen) setLastReadChatLen(chatMessages.length);
  }, [chatOpen, chatMessages.length]);

  const unreadChatCount = chatOpen
    ? 0
    : chatMessages.slice(lastReadChatLen).filter((m) => m.senderId !== myPlayerId).length;

  const drawer = state.players[state.drawerIndex];
  const isDrawer = drawer?.id === myPlayerId;

  // Prevent iOS/Telegram WebView vertical page scroll/swipe while drawing on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isDrawer || state.phase !== 'drawing') return;
    const stopTouch = (e: TouchEvent) => {
      e.preventDefault();
    };
    canvas.addEventListener('touchstart', stopTouch, { passive: false });
    canvas.addEventListener('touchmove', stopTouch, { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', stopTouch);
      canvas.removeEventListener('touchmove', stopTouch);
    };
  }, [isDrawer, state.phase]);

  // Redraw canvas whenever strokes change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0f291c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const s of state.strokes) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size;
      ctx.beginPath();
      ctx.moveTo(s.x1 * canvas.width, s.y1 * canvas.height);
      ctx.lineTo(s.x2 * canvas.width, s.y2 * canvas.height);
      ctx.stroke();
    }
  }, [state.strokes]);

  const getNormCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  };

  const emitStroke = (x1: number, y1: number, x2: number, y2: number) => {
    const stroke: CrocodileStroke = { x1, y1, x2, y2, color, size: brushSize };
    onAction({ type: 'CROCO_DRAW', playerId: myPlayerId, stroke });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer || state.phase !== 'drawing') return;
    const pos = getNormCoords(e.clientX, e.clientY);
    if (!pos) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drawingRef.current = true;
    lastPosRef.current = pos;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !isDrawer || state.phase !== 'drawing') return;
    const pos = getNormCoords(e.clientX, e.clientY);
    const prev = lastPosRef.current;
    if (!pos || !prev) return;
    if (Math.hypot(pos.x - prev.x, pos.y - prev.y) < 0.004) return;
    emitStroke(prev.x, prev.y, pos.x, pos.y);
    lastPosRef.current = pos;
  };

  const handlePointerUp = () => {
    drawingRef.current = false;
    lastPosRef.current = null;
  };

  const handleGuessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guessText.trim() || isDrawer || state.phase !== 'drawing') return;
    onAction({ type: 'CROCO_GUESS', playerId: myPlayerId, text: guessText.trim() });
    setGuessText('');
  };

  return (
    <div className="min-h-screen w-full felt-table flex flex-col justify-between p-2.5 sm:p-4 text-white">
      {/* Header */}
      <header className="flex items-center justify-between gap-2 bg-black/35 border border-white/15 rounded-2xl px-3 py-2 backdrop-blur-md">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">🎨</span>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-extrabold text-amber-300 truncate">
              Крокодил • {roomCode}
            </div>
            <div className="text-[11px] text-emerald-200/80 truncate">
              Раунд {state.round} • Малює: {drawer?.name}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="relative px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold"
          >
            <MessageCircle className="w-4 h-4" />
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow">
                {unreadChatCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 text-xs font-bold flex items-center gap-1"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Word Banner & Scores */}
      <div className="max-w-xl mx-auto w-full my-2 space-y-2">
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-black/35 border border-white/15 text-xs">
          {isDrawer ? (
            <div className="flex items-center gap-2">
              <span className="text-emerald-200">Загадано:</span>
              <span className="text-sm font-black text-amber-300">{state.word}</span>
              {state.phase === 'drawing' && state.strokes.length === 0 && (
                <button
                  type="button"
                  onClick={() => onAction({ type: 'CROCO_SKIP_WORD', playerId: myPlayerId })}
                  className="p-1 rounded-lg bg-white/10 hover:bg-white/20"
                  title="Інше слово"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div>
              Слово: <b className="text-amber-300">{state.word ? state.word : `${state.wordLength} літер`}</b>
            </div>
          )}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {state.players.map((p) => (
              <span key={p.id} className="px-2 py-0.5 rounded-lg bg-white/10 text-[11px] font-bold shrink-0">
                {p.name}: {p.score}
              </span>
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div className="rounded-2xl overflow-hidden border-2 border-white/20 bg-[#0f291c] shadow-xl">
          <canvas
            ref={canvasRef}
            width={600}
            height={380}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className="w-full h-auto touch-none block cursor-crosshair"
          />
        </div>

        {/* Drawer Tools */}
        {isDrawer && state.phase === 'drawing' && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-black/35 border border-white/15">
            <div className="flex items-center gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-6 h-6 rounded-full border-2 ${
                    color === c ? 'border-amber-400 scale-110' : 'border-white/30'
                  }`}
                />
              ))}
              <button
                type="button"
                onClick={() => setColor('#0f291c')}
                className={`p-1.5 rounded-lg border ${
                  color === '#0f291c' ? 'bg-amber-400 text-slate-950 border-amber-300' : 'bg-white/10 border-white/15'
                }`}
                title="Гумка"
              >
                <Eraser className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {[3, 6, 10].map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setBrushSize(sz)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                    brushSize === sz ? 'bg-amber-400 text-slate-950' : 'bg-white/10 text-white'
                  }`}
                >
                  {sz}px
                </button>
              ))}
              <button
                type="button"
                onClick={() => onAction({ type: 'CROCO_CLEAR', playerId: myPlayerId })}
                className="p-1.5 rounded-lg bg-rose-500/30 hover:bg-rose-500/50 text-rose-200"
                title="Очистити"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Guesses List */}
        <div className="rounded-xl bg-black/30 border border-white/10 p-2 max-h-24 overflow-y-auto space-y-1 text-xs">
          {state.guesses.length === 0 ? (
            <div className="text-white/45 text-center py-1">Поки немає варіантів...</div>
          ) : (
            state.guesses.slice(-6).map((g) => (
              <div key={g.id} className={g.correct ? 'text-amber-300 font-bold' : 'text-white/85'}>
                <b>{g.playerName}:</b> {g.text} {g.correct ? '✅' : ''}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bottom Input or Next Round */}
      <div className="max-w-xl mx-auto w-full">
        {state.phase === 'round_over' ? (
          <div className="rounded-2xl bg-black/45 border border-amber-400/45 p-3 text-center space-y-2">
            <div className="text-sm font-black text-amber-300">
              🎉 {state.winnerName} вгадав слово «{state.word}»!
            </div>
            <button
              type="button"
              onClick={() => onAction({ type: 'CROCO_NEW_ROUND', playerId: myPlayerId })}
              className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Наступний раунд
            </button>
          </div>
        ) : !isDrawer ? (
          <form onSubmit={handleGuessSubmit} className="flex gap-2">
            <input
              type="text"
              value={guessText}
              onChange={(e) => setGuessText(e.target.value)}
              placeholder="Напишіть слово-здогадку..."
              className="flex-1 px-3 py-2.5 rounded-xl bg-black/45 border border-white/20 text-sm text-white placeholder-white/45 focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              disabled={!guessText.trim()}
              className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm disabled:opacity-40 flex items-center gap-1"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <div className="text-center text-xs text-emerald-200/75 py-1">
            Ви малюєте! Інші гравці зараз відгадують ваше слово.
          </div>
        )}
      </div>

      {chatOpen && (
        <ChatDrawer
          title={`Чат кімнати ${roomCode}`}
          messages={chatMessages}
          myPlayerId={myPlayerId}
          onSend={onSendChat}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
};
