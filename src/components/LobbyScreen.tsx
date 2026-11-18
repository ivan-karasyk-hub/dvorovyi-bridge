import React, { useState } from 'react';
import {
  Users,
  Play,
  Copy,
  Check,
  Eye,
  Plus,
  LogIn,
  Wifi,
  WifiOff,
  Bot,
  X,
  Send,
  Coins,
  Trophy,
  ShieldAlert,
  UserPlus,
  UserCheck,
} from 'lucide-react';
import type {
  DurakMode,
  FriendEntry,
  FriendRequestEntry,
  GameType,
  RoomInfo,
  WalletSummary,
} from '../shared/types';
import { copyTextToClipboard, getRoomInviteUrl, shareRoomInTelegram } from '../utils/telegram';

interface LobbyScreenProps {
  playerName: string;
  onChangeName: (name: string) => void;
  room: RoomInfo | null;
  connected: boolean;
  error: string | null;
  initialJoinCode?: string | null;
  wallet: WalletSummary | null;
  leaderboard: WalletSummary[];
  adminWallets: WalletSummary[];
  friends: FriendEntry[];
  incomingRequests: FriendRequestEntry[];
  selectedGameType: GameType;
  selectedDurakMode: DurakMode;
  onSelectGameType: (gameType: GameType) => void;
  onSelectDurakMode: (mode: DurakMode) => void;
  onSetRoomGame: (gameType: GameType, durakMode: DurakMode) => void;
  onClaimBonus: () => void;
  onFetchLeaderboard: () => void;
  onFetchAdminWallets: () => void;
  onAdminAdjustChips: (targetId: string, delta: number) => void;
  onSendFriendRequest: (targetId: string) => void;
  onRespondFriendRequest: (fromId: string, accept: boolean) => void;
  onInviteFriend: (friendId: string, code: string) => void;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onAddBot: () => void;
  onRemoveBot: (botId: string) => void;
  onStartOnlineGame: () => void;
  onLeaveRoom: () => void;
  onStartSandbox: (playerCount: 2 | 3 | 4 | 5 | 6) => void;
  currentPlayerId: string;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  playerName,
  onChangeName,
  room,
  connected,
  error,
  initialJoinCode,
  wallet,
  leaderboard,
  adminWallets,
  friends,
  incomingRequests,
  selectedGameType,
  selectedDurakMode,
  onSelectGameType,
  onSelectDurakMode,
  onSetRoomGame,
  onClaimBonus,
  onFetchLeaderboard,
  onFetchAdminWallets,
  onAdminAdjustChips,
  onSendFriendRequest,
  onRespondFriendRequest,
  onInviteFriend,
  onCreateRoom,
  onJoinRoom,
  onAddBot,
  onRemoveBot,
  onStartOnlineGame,
  onLeaveRoom,
  onStartSandbox,
  currentPlayerId,
}) => {
  const [joinCode, setJoinCode] = useState(initialJoinCode ?? '');
  const [sandboxCount, setSandboxCount] = useState<2 | 3 | 4 | 5 | 6>(2);
  const [copied, setCopied] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [friendTargetId, setFriendTargetId] = useState('');
  const [invitedFriendIds, setInvitedFriendIds] = useState<string[]>([]);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminTargetId, setAdminTargetId] = useState('');
  const [adminDelta, setAdminDelta] = useState('1000');

  const handleCopyInvite = async () => {
    if (!room) return;
    const url = getRoomInviteUrl(room.code);
    const ok = await copyTextToClipboard(url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      window.prompt('Скопіюйте посилання вручну:', url);
    }
  };

  const friendsModal = showFriends ? (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-3xl bg-[#0b2919] border border-sky-400/35 p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-sky-400" />
            <h3 className="font-bold text-white">Друзі</h3>
          </div>
          <button
            type="button"
            onClick={() => setShowFriends(false)}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={friendTargetId}
            onChange={(e) => setFriendTargetId(e.target.value)}
            placeholder="TG ID друга (напр. 123456789)"
            className="flex-1 px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-xs text-white placeholder-white/40 focus:outline-none focus:border-sky-400"
          />
          <button
            type="button"
            disabled={!friendTargetId.trim()}
            onClick={() => {
              onSendFriendRequest(friendTargetId.trim());
              setFriendTargetId('');
            }}
            className="px-3 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-white text-xs font-bold"
          >
            Додати
          </button>
        </div>

        {incomingRequests.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-amber-300">Запити в друзі:</div>
            {incomingRequests.map((req) => (
              <div
                key={req.fromId}
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-400/10 border border-amber-400/30 text-xs"
              >
                <span className="font-semibold text-white truncate">{req.fromName}</span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => onRespondFriendRequest(req.fromId, true)}
                    className="px-2 py-1 rounded-lg bg-emerald-500 text-slate-950 font-bold text-[11px]"
                  >
                    Прийняти
                  </button>
                  <button
                    type="button"
                    onClick={() => onRespondFriendRequest(req.fromId, false)}
                    className="px-2 py-1 rounded-lg bg-white/10 text-white/80 text-[11px]"
                  >
                    Ні
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-1.5 max-h-52 overflow-y-auto">
          <div className="text-[11px] text-emerald-200/75">
            Список друзів ({friends.length}):
          </div>
          {friends.length === 0 ? (
            <p className="text-xs text-center text-white/50 py-3">
              Поки що немає друзів. Додайте друга в кімнаті або за TG ID!
            </p>
          ) : (
            friends.map((f) => {
              const inRoom = room?.players.some((p) => p.id === f.playerId) ?? false;
              const invited = invitedFriendIds.includes(f.playerId);
              return (
                <div
                  key={f.playerId}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        f.online ? 'bg-emerald-400' : 'bg-white/30'
                      }`}
                    />
                    <span className="font-semibold text-white truncate">{f.name}</span>
                  </div>
                  {room && f.online && !inRoom ? (
                    <button
                      type="button"
                      disabled={invited}
                      onClick={() => {
                        onInviteFriend(f.playerId, room.code);
                        setInvitedFriendIds((prev) => [...prev, f.playerId]);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-[11px]"
                    >
                      {invited ? 'Надіслано ✓' : 'Запросити'}
                    </button>
                  ) : (
                    <span className="text-[10px] text-white/50">
                      {inRoom ? 'У кімнаті' : f.online ? 'Онлайн' : 'Офлайн'}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  ) : null;

  if (room) {
    const isHost = room.players.find((p) => p.id === currentPlayerId)?.isHost ?? false;

    return (
      <div className="min-h-full felt-table flex flex-col items-center justify-center p-4 safe-top safe-bottom">
        <div className="w-full max-w-sm rounded-3xl bg-black/35 backdrop-blur-md border border-emerald-400/25 p-5 shadow-2xl space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-emerald-300/80">
                Кімната для друзів
              </div>
              <div className="text-3xl font-black tracking-widest text-amber-300 mt-0.5">
                {room.code}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowFriends(true)}
                className="relative flex items-center gap-1 px-2.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white active:scale-95 transition"
                title="Друзі та запрошення"
              >
                <Users className="w-3.5 h-3.5 text-sky-300" />
                Друзі
                {incomingRequests.length > 0 && (
                  <span className="px-1 rounded-full bg-rose-500 text-white text-[9px] font-extrabold">
                    {incomingRequests.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => shareRoomInTelegram(room.code)}
                className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-xs font-bold text-white active:scale-95 transition shadow"
                title="Обрати контакт або чат у Telegram"
              >
                <Send className="w-3.5 h-3.5" />
                У ТГ
              </button>
              <button
                type="button"
                onClick={handleCopyInvite}
                className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white active:scale-95 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Ок' : 'Лінк'}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {/* Game mode inside room */}
            <div className="rounded-xl bg-white/5 border border-white/10 p-2.5 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-emerald-200/80">
                <span>Гра:</span>
                {isHost ? (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => onSetRoomGame('bridge', room.durakMode)}
                      className={`px-2.5 py-1 rounded-lg font-bold transition ${
                        room.gameType === 'bridge'
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-white/10 text-white/75'
                      }`}
                    >
                      Брідж
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetRoomGame('durak', room.durakMode)}
                      className={`px-2.5 py-1 rounded-lg font-bold transition ${
                        room.gameType === 'durak'
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-white/10 text-white/75'
                      }`}
                    >
                      Дурак
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetRoomGame('holdem', room.durakMode)}
                      className={`px-2.5 py-1 rounded-lg font-bold transition ${
                        room.gameType === 'holdem'
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-white/10 text-white/75'
                      }`}
                    >
                      Холдем
                    </button>
                  </div>
                ) : (
                  <span className="font-bold text-amber-300">
                    {room.gameType === 'durak'
                      ? `Дурак (${room.durakMode === 'perevodnoy' ? 'Перевідний' : 'Підкидний'})`
                      : room.gameType === 'holdem'
                        ? 'Техаський Холдем'
                        : 'Карасьовий Брідж'}
                  </span>
                )}
              </div>
              {isHost && room.gameType === 'durak' && (
                <div className="flex items-center justify-between text-[11px] text-emerald-200/80">
                  <span>Режим Дурака:</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => onSetRoomGame('durak', 'podkidnoy')}
                      className={`px-2 py-0.5 rounded-md font-semibold ${
                        room.durakMode === 'podkidnoy'
                          ? 'bg-emerald-400 text-slate-950'
                          : 'bg-white/10 text-white/75'
                      }`}
                    >
                      Підкидний
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetRoomGame('durak', 'perevodnoy')}
                      className={`px-2 py-0.5 rounded-md font-semibold ${
                        room.durakMode === 'perevodnoy'
                          ? 'bg-emerald-400 text-slate-950'
                          : 'bg-white/10 text-white/75'
                      }`}
                    >
                      Перевідний
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="text-xs text-emerald-200/80 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Гравці ({room.players.length}/6):
              </span>
              {isHost && room.players.length < 6 && (
                <button
                  type="button"
                  onClick={onAddBot}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-400/20 hover:bg-sky-400/30 border border-sky-400/35 text-sky-200 text-[11px] font-bold active:scale-95 transition"
                >
                  <Bot className="w-3.5 h-3.5" />
                  + Додати бота
                </button>
              )}
            </div>
            {room.players.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/5 border border-white/10"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      p.connected ? 'bg-emerald-400' : 'bg-rose-400'
                    }`}
                  />
                  {p.isBot && <Bot className="w-3.5 h-3.5 text-sky-300 shrink-0" />}
                  <span className="font-medium text-sm text-white truncate">
                    {p.name}
                    {p.id === currentPlayerId && ' (Ви)'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {!p.isBot &&
                    p.id !== currentPlayerId &&
                    !friends.some((f) => f.playerId === p.id) && (
                      <button
                        type="button"
                        onClick={() => onSendFriendRequest(p.id)}
                        className="px-2 py-0.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/35 text-sky-200 text-[10px] font-bold flex items-center gap-1"
                        title="Додати в друзі"
                      >
                        <UserPlus className="w-3 h-3" />
                        Друг
                      </button>
                    )}
                  {p.isHost && (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                      Хост
                    </span>
                  )}
                  {isHost && p.isBot && (
                    <button
                      type="button"
                      onClick={() => onRemoveBot(p.id)}
                      className="p-1 rounded-md bg-white/10 hover:bg-rose-500/40 text-white/70 hover:text-white transition"
                      title="Прибрати бота"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Quick invite online friends directly inside the app */}
            {room.players.length < 6 &&
              friends.some((f) => f.online && !room.players.some((p) => p.id === f.playerId)) && (
                <div className="pt-1 space-y-1">
                  <div className="text-[10px] text-emerald-200/75">Друзі онлайн (запросити в 1 клік):</div>
                  <div className="flex flex-wrap gap-1.5">
                    {friends
                      .filter((f) => f.online && !room.players.some((p) => p.id === f.playerId))
                      .map((f) => {
                        const sent = invitedFriendIds.includes(f.playerId);
                        return (
                          <button
                            key={f.playerId}
                            type="button"
                            disabled={sent}
                            onClick={() => {
                              onInviteFriend(f.playerId, room.code);
                              setInvitedFriendIds((prev) => [...prev, f.playerId]);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 disabled:opacity-50 border border-emerald-400/30 text-emerald-100 text-[11px] font-semibold"
                          >
                            <UserCheck className="w-3 h-3" />
                            {f.name} {sent ? '✓' : '+'}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
          </div>

          {error && (
            <div className="text-xs text-rose-300 bg-rose-950/60 border border-rose-400/30 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onLeaveRoom}
              className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-semibold text-white/90"
            >
              Вийти
            </button>
            {isHost ? (
              <button
                type="button"
                disabled={room.players.length < 2}
                onClick={onStartOnlineGame}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:pointer-events-none text-slate-950 font-extrabold text-sm shadow-lg active:scale-95 transition"
              >
                <Play className="w-4 h-4 fill-current" />
                Почати гру
              </button>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-emerald-200/80 bg-white/5 rounded-xl px-3">
                Очікуємо старт від хоста...
              </div>
            )}
          </div>
        </div>
        {friendsModal}
      </div>
    );
  }

  return (
    <div className="min-h-full felt-table flex flex-col items-center justify-center p-4 safe-top safe-bottom overflow-y-auto">
      <div className="w-full max-w-sm space-y-4">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/30 border border-white/10 text-[11px] text-emerald-200">
              {connected ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" /> Онлайн
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-400" /> Офлайн
                </>
              )}
            </div>
            {wallet && (
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/35 text-[11px] font-extrabold text-amber-300">
                <Coins className="w-3.5 h-3.5" />
                {wallet.chips}
              </div>
            )}
            {connected && (
              <button
                type="button"
                onClick={() => {
                  onFetchLeaderboard();
                  setShowLeaderboard(true);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-[11px] font-bold text-white"
              >
                <Trophy className="w-3 h-3 text-amber-300" />
                Топ
              </button>
            )}
            {connected && (
              <button
                type="button"
                onClick={() => setShowFriends(true)}
                className="relative inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-[11px] font-bold text-white"
              >
                <Users className="w-3 h-3 text-sky-300" />
                Друзі
                {incomingRequests.length > 0 && (
                  <span className="ml-0.5 px-1.5 rounded-full bg-rose-500 text-white text-[9px] font-extrabold">
                    {incomingRequests.length}
                  </span>
                )}
              </button>
            )}
            {connected && wallet?.isAdmin && (
              <button
                type="button"
                onClick={() => {
                  onFetchAdminWallets();
                  setShowAdmin(true);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/25 hover:bg-rose-500/40 border border-rose-400/40 text-[11px] font-bold text-rose-200"
              >
                <ShieldAlert className="w-3 h-3" />
                Адмін
              </button>
            )}
          </div>
          {wallet && wallet.chips < 100 && (
            <div>
              <button
                type="button"
                onClick={onClaimBonus}
                className="text-[11px] font-bold text-emerald-300 underline"
              >
                Отримати бонус +200 фішок
              </button>
            </div>
          )}
          <h1 className="text-3xl font-black tracking-tight text-white">Карасьовий Брідж</h1>
          <p className="text-xs text-emerald-200/75">
            {selectedGameType === 'durak'
              ? `Дурак (${selectedDurakMode === 'perevodnoy' ? 'Перевідний' : 'Підкидний'}) • 2–6 гравців`
              : selectedGameType === 'holdem'
                ? 'Техаський Холдем на фішки • 2–6 гравців'
                : 'Гра до 125 очок • 2–6 гравців'}
          </p>
          <div className="flex items-center justify-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => onSelectGameType('bridge')}
              className={`px-3 py-1 rounded-full text-[11px] font-extrabold transition ${
                selectedGameType === 'bridge'
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-white/10 text-white/75 hover:bg-white/20'
              }`}
            >
              Брідж
            </button>
            <button
              type="button"
              onClick={() => onSelectGameType('durak')}
              className={`px-3 py-1 rounded-full text-[11px] font-extrabold transition ${
                selectedGameType === 'durak'
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-white/10 text-white/75 hover:bg-white/20'
              }`}
            >
              Дурак
            </button>
            <button
              type="button"
              onClick={() => onSelectGameType('holdem')}
              className={`px-3 py-1 rounded-full text-[11px] font-extrabold transition ${
                selectedGameType === 'holdem'
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-white/10 text-white/75 hover:bg-white/20'
              }`}
            >
              Холдем
            </button>
          </div>
          {selectedGameType === 'durak' && (
            <div className="flex items-center justify-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => onSelectDurakMode('podkidnoy')}
                className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${
                  selectedDurakMode === 'podkidnoy'
                    ? 'bg-emerald-400 text-slate-950'
                    : 'bg-white/10 text-white/70'
                }`}
              >
                Підкидний
              </button>
              <button
                type="button"
                onClick={() => onSelectDurakMode('perevodnoy')}
                className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${
                  selectedDurakMode === 'perevodnoy'
                    ? 'bg-emerald-400 text-slate-950'
                    : 'bg-white/10 text-white/70'
                }`}
              >
                Перевідний
              </button>
            </div>
          )}
        </div>

        {/* Player Name */}
        <div className="rounded-2xl bg-black/30 backdrop-blur-md border border-white/10 p-4 space-y-2">
          <label className="block text-xs font-semibold text-emerald-200/90">Ваше ім'я</label>
          <input
            type="text"
            value={playerName}
            maxLength={18}
            onChange={(e) => onChangeName(e.target.value)}
            placeholder="Введіть ім'я..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder-white/40 text-sm focus:outline-none focus:border-amber-400"
          />
        </div>

        {error && (
          <div className="text-xs text-rose-300 bg-rose-950/70 border border-rose-400/30 rounded-xl px-3.5 py-2.5">
            {error}
          </div>
        )}

        {/* Friends Multiplayer */}
        <div className="rounded-2xl bg-black/30 backdrop-blur-md border border-emerald-400/25 p-4 space-y-3">
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" />
            Грати з друзями
          </div>

          <button
            type="button"
            disabled={!connected}
            onClick={onCreateRoom}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-extrabold text-sm shadow-lg active:scale-95 transition"
          >
            <Plus className="w-4 h-4" />
            Створити кімнату
          </button>

          <div className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              maxLength={4}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="КОД"
              className="w-28 px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-center font-bold tracking-widest text-white placeholder-white/40 text-sm uppercase focus:outline-none focus:border-emerald-400"
            />
            <button
              type="button"
              disabled={!connected || joinCode.trim().length < 4}
              onClick={() => onJoinRoom(joinCode)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold text-sm active:scale-95 transition"
            >
              <LogIn className="w-4 h-4" />
              Увійти
            </button>
          </div>
        </div>

        {/* Local Sandbox Mode */}
        <div className="rounded-2xl bg-black/25 backdrop-blur-md border border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <Eye className="w-4 h-4 text-sky-400" />
              Навчання (тест правил)
            </div>
            <div className="flex gap-1">
              {([2, 3, 4, 5, 6] as const).map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setSandboxCount(cnt)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition ${
                    sandboxCount === cnt
                      ? 'bg-sky-400 text-slate-950'
                      : 'bg-white/10 text-white/75 hover:bg-white/20'
                  }`}
                >
                  {cnt}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-emerald-200/70">
            Локальний стіл на 2–6 гравців з відкритими картами для навчання та перевірки правил.
          </p>
          <button
            type="button"
            onClick={() => onStartSandbox(sandboxCount)}
            className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-sm active:scale-95 transition"
          >
            Запустити Навчання ({sandboxCount} гравці)
          </button>
        </div>
      </div>

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#0b2919] border border-amber-400/35 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white">Топ гравців (Фішки)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLeaderboard(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {leaderboard.length === 0 ? (
                <p className="text-xs text-center text-emerald-200/70 py-4">
                  Поки що немає записів
                </p>
              ) : (
                leaderboard.map((entry, idx) => (
                  <div
                    key={entry.playerId}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-extrabold text-amber-300 w-5">#{idx + 1}</span>
                      <span className="font-semibold text-white truncate">{entry.name}</span>
                    </div>
                    <div className="flex items-center gap-1 font-extrabold text-amber-300 shrink-0">
                      <Coins className="w-3.5 h-3.5" />
                      {entry.chips}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {friendsModal}

      {/* Admin Modal */}
      {showAdmin && wallet?.isAdmin && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#0b2919] border border-rose-400/40 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-white">Адмін-панель фішок</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAdmin(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] text-emerald-200/80">
                Telegram ID (наприклад `123456789` або `tg_123456789`):
              </label>
              <input
                type="text"
                value={adminTargetId}
                onChange={(e) => setAdminTargetId(e.target.value)}
                placeholder="Введіть TG ID..."
                className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-xs text-white placeholder-white/40 focus:outline-none focus:border-rose-400"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  value={adminDelta}
                  onChange={(e) => setAdminDelta(e.target.value)}
                  placeholder="Сума"
                  className="w-28 px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-xs text-white focus:outline-none focus:border-rose-400"
                />
                <button
                  type="button"
                  disabled={!adminTargetId.trim() || !Number.isFinite(Number(adminDelta))}
                  onClick={() => {
                    onAdminAdjustChips(adminTargetId.trim(), Number(adminDelta));
                  }}
                  className="flex-1 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 disabled:opacity-40 text-white font-bold text-xs active:scale-95 transition"
                >
                  Нарахувати
                </button>
              </div>
              <div className="flex gap-1.5">
                {[500, 1000, 5000, -500].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAdminDelta(String(preset))}
                    className="flex-1 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold text-white/85"
                  >
                    {preset > 0 ? `+${preset}` : preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pt-1 border-t border-white/10">
              <div className="text-[10px] text-emerald-200/70">
                Гравці (натисни, щоб обрати):
              </div>
              {adminWallets.map((w) => (
                <button
                  key={w.playerId}
                  type="button"
                  onClick={() => setAdminTargetId(w.playerId)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-white truncate">{w.name}</div>
                    <div className="text-[10px] text-white/50 truncate">{w.playerId}</div>
                  </div>
                  <div className="font-extrabold text-amber-300 shrink-0 ml-2">
                    {w.chips}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
