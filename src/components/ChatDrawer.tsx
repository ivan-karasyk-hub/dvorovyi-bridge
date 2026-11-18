import React, { useEffect, useRef, useState } from 'react';
import { Send, X } from 'lucide-react';
import type { ChatMessage } from '../shared/types';

interface ChatDrawerProps {
  title: string;
  myPlayerId: string;
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onClose: () => void;
}

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  title,
  myPlayerId,
  messages,
  onSend,
  onClose,
}) => {
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-sm h-[65dvh] sm:h-[460px] flex flex-col rounded-3xl bg-[#0b2919] border border-emerald-400/35 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <h3 className="font-bold text-sm text-white truncate">💬 {title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2">
          {messages.length === 0 ? (
            <div className="text-center text-xs text-white/45 py-8">
              Повідомлень поки немає — напишіть першими!
            </div>
          ) : (
            messages.map((m) => {
              const isMe = m.senderId === myPlayerId;
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  {!isMe && (
                    <span className="text-[10px] text-emerald-200/75 px-1 mb-0.5">
                      {m.senderName}
                    </span>
                  )}
                  <div
                    className={`max-w-[82%] px-3 py-1.5 rounded-2xl text-xs break-words ${
                      isMe
                        ? 'bg-amber-400 text-slate-950 font-semibold rounded-br-sm'
                        : 'bg-white/10 text-white rounded-bl-sm'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-2.5 border-t border-white/10 flex gap-2 shrink-0 bg-black/25"
        >
          <input
            type="text"
            value={text}
            maxLength={250}
            onChange={(e) => setText(e.target.value)}
            placeholder="Написати повідомлення..."
            className="flex-1 px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-400"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-bold active:scale-95 transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
