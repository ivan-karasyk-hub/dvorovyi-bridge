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
  Lock,
  Globe,
  RefreshCw,
  MessageCircle,
} from 'lucide-react';
import type {
  AdminOnlinePlayer,
  AdminRoomInfo,
  BridgeMode,
  ChatMessage,
  DurakMode,
  FriendEntry,
  FriendRequestEntry,
  GameType,
  PublicRoomSummary,
  RoomInfo,
  ServerConfig,
  WalletSummary,
} from '../shared/types';
import { copyTextToClipboard, getRoomInviteUrl, shareRoomInTelegram } from '../utils/telegram';
import { ChatDrawer } from './ChatDrawer';

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
  adminRooms: AdminRoomInfo[];
  adminOnlinePlayers: AdminOnlinePlayer[];
  serverConfig: ServerConfig;
  dailyRewardPopup: number | null;
  friends: FriendEntry[];
  incomingRequests: FriendRequestEntry[];
  publicRooms: PublicRoomSummary[];
  selectedGameType: GameType;
  selectedBridgeMode: BridgeMode;
  selectedDurakMode: DurakMode;
  onSelectGameType: (gameType: GameType) => void;
  onSelectBridgeMode: (mode: BridgeMode) => void;
  onSelectDurakMode: (mode: DurakMode) => void;
  onSetRoomGame: (gameType: GameType, durakMode: DurakMode, bridgeMode?: BridgeMode) => void;
  onClaimBonus: () => void;
  onClaimDailyBonus: () => void;
  onFetchLeaderboard: () => void;
  onFetchAdminWallets: () => void;
  onAdminAdjustChips: (targetId: string, delta: number) => void;
  onAdminGiftAll: (amount: number) => void;
  onAdminSetBan: (targetId: string, banned: boolean) => void;
  onAdminUpdateConfig: (config: Partial<ServerConfig>) => void;
  adminBackupJson: string | null;
  onAdminExportBackup: () => void;
  onAdminImportBackup: (backupJson: string) => void;
  onAdminCloseRoom: (code: string) => void;
  onAdminKickPlayer: (code: string, targetId: string) => void;
  onAdminBroadcast: (message: string) => void;
  onSendFriendRequest: (targetId: string) => void;
  onRespondFriendRequest: (fromId: string, accept: boolean) => void;
  onInviteFriend: (friendId: string, code: string) => void;
  onOpenFriendChat: (friendId: string, friendName: string) => void;
  roomChatMessages: ChatMessage[];
  onSendRoomChat: (code: string, text: string) => void;
  onRefreshPublicRooms: () => void;
  onOpenSlot: () => void;
  onPlayBlackjackSolo: () => void;
  onCreateRoom: (isPublic: boolean, password?: string) => void;
  onJoinRoom: (code: string, password?: string) => void;
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
  adminRooms,
  adminOnlinePlayers,
  serverConfig,
  dailyRewardPopup,
  friends,
  incomingRequests,
  publicRooms,
  selectedGameType,
  selectedBridgeMode,
  selectedDurakMode,
  onSelectGameType,
  onSelectBridgeMode,
  onSelectDurakMode,
  onSetRoomGame,
  onClaimBonus,
  onClaimDailyBonus,
  onFetchLeaderboard,
  onFetchAdminWallets,
  onAdminAdjustChips,
  onAdminGiftAll,
  onAdminSetBan,
  onAdminUpdateConfig,
  adminBackupJson,
  onAdminExportBackup,
  onAdminImportBackup,
  onAdminCloseRoom,
  onAdminKickPlayer,
  onAdminBroadcast,
  onSendFriendRequest,
  onRespondFriendRequest,
  onInviteFriend,
  onOpenFriendChat,
  roomChatMessages,
  onSendRoomChat,
  onRefreshPublicRooms,
  onOpenSlot,
  onPlayBlackjackSolo,
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
  const [roomIsPublic, setRoomIsPublic] = useState(true);
  const [roomPassword, setRoomPassword] = useState('');
  const [sandboxCount, setSandboxCount] = useState<2 | 3 | 4 | 5 | 6>(2);
  const [copied, setCopied] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [showRoomChat, setShowRoomChat] = useState(false);
  const [lastReadRoomChatLen, setLastReadRoomChatLen] = useState(0);
  const unreadRoomChatCount = showRoomChat
    ? 0
    : roomChatMessages
        .slice(lastReadRoomChatLen)
        .filter((m) => m.senderId !== currentPlayerId).length;
  React.useEffect(() => {
    if (showRoomChat) {
      setLastReadRoomChatLen(roomChatMessages.length);
    }
  }, [showRoomChat, roomChatMessages.length]);
  const [friendTargetId, setFriendTargetId] = useState('');
  const [restoreText, setRestoreText] = useState('');
  const [backupCopied, setBackupCopied] = useState(false);
  const [invitedFriendIds, setInvitedFriendIds] = useState<string[]>([]);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminTab, setAdminTab] = useState<'chips' | 'rooms' | 'notice'>('chips');
  const [adminTargetId, setAdminTargetId] = useState('');
  const [adminDelta, setAdminDelta] = useState('1000');
  const [adminNoticeText, setAdminNoticeText] = useState('');

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
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setShowFriends(false);
                        onOpenFriendChat(f.playerId, f.name);
                      }}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sky-300"
                      title="Написати повідомлення"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </button>
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
                onClick={() => setShowRoomChat(true)}
                className="relative flex items-center gap-1 px-2.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-emerald-200 active:scale-95 transition"
                title="Чат кімнати"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                {unreadRoomChatCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow">
                    {unreadRoomChatCount}
                  </span>
                )}
              </button>
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
                className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-xs font-bold text-white whitespace-nowrap active:scale-95 transition shadow"
                title="Обрати контакт або чат у Telegram"
              >
                <Send className="w-3.5 h-3.5" />
                TG
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
              <div
                className={
                  isHost
                    ? 'space-y-1.5 text-[11px] text-emerald-200/80'
                    : 'flex items-center justify-between text-[11px] text-emerald-200/80'
                }
              >
                <span>Гра:</span>
                {isHost ? (
                  <div className="flex flex-wrap gap-1.5">
                    {serverConfig.bridgeEnabled && (
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
                    )}
                    {serverConfig.durakEnabled && (
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
                    )}
                    {serverConfig.holdemEnabled && (
                      <button
                        type="button"
                        onClick={() => onSetRoomGame('holdem', room.durakMode)}
                        className={`px-2.5 py-1 rounded-lg font-bold transition ${
                          room.gameType === 'holdem'
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-white/10 text-white/75'
                        }`}
                      >
                        Покер
                      </button>
                    )}
                    {serverConfig.blackjackEnabled && (
                      <button
                        type="button"
                        onClick={() => onSetRoomGame('blackjack', room.durakMode)}
                        className={`px-2.5 py-1 rounded-lg font-bold transition ${
                          room.gameType === 'blackjack'
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-white/10 text-white/75'
                        }`}
                      >
                        🃏 21
                      </button>
                    )}
                    {serverConfig.spyEnabled && (
                      <button
                        type="button"
                        onClick={() => onSetRoomGame('spy', room.durakMode)}
                        className={`px-2.5 py-1 rounded-lg font-bold transition ${
                          room.gameType === 'spy'
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-white/10 text-white/75'
                        }`}
                      >
                        🕵️ Шпигун
                      </button>
                    )}
                    {serverConfig.crocodileEnabled && (
                      <button
                        type="button"
                        onClick={() => onSetRoomGame('crocodile', room.durakMode)}
                        className={`px-2.5 py-1 rounded-lg font-bold transition ${
                          room.gameType === 'crocodile'
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-white/10 text-white/75'
                        }`}
                      >
                        🎨 Крокодил
                      </button>
                    )}
                    {serverConfig.debertsEnabled && (
                      <button
                        type="button"
                        onClick={() => onSetRoomGame('deberts', room.durakMode)}
                        className={`px-2.5 py-1 rounded-lg font-bold transition ${
                          room.gameType === 'deberts'
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-white/10 text-white/75'
                        }`}
                      >
                        🂡 Деберц
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="font-bold text-amber-300">
                    {room.gameType === 'durak'
                      ? `Дурак (${room.durakMode === 'perevodnoy' ? 'Перевідний' : 'Підкидний'})`
                      : room.gameType === 'holdem'
                        ? 'Покер'
                        : room.gameType === 'blackjack'
                          ? 'Блекджек 21'
                          : room.gameType === 'spy'
                            ? 'Шпигун'
                            : room.gameType === 'crocodile'
                              ? 'Крокодил'
                              : room.gameType === 'deberts'
                                ? 'Деберц'
                                : `${serverConfig.karasykBrandingEnabled ? 'Карасьовий Брідж' : 'Брідж'} (${(room.bridgeMode ?? 'kalynivskyi') === 'classic' ? 'Дефолт' : 'Калинівський'})`}
                  </span>
                )}
              </div>
              {isHost && room.gameType === 'bridge' && (
                <div className="flex items-center justify-between text-[11px] text-emerald-200/80">
                  <span>Режим Бріджу:</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => onSetRoomGame('bridge', room.durakMode, 'kalynivskyi')}
                      className={`px-2 py-0.5 rounded-md font-semibold ${
                        (room.bridgeMode ?? 'kalynivskyi') === 'kalynivskyi'
                          ? 'bg-emerald-400 text-slate-950'
                          : 'bg-white/10 text-white/75'
                      }`}
                    >
                      Калинівський
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetRoomGame('bridge', room.durakMode, 'classic')}
                      className={`px-2 py-0.5 rounded-md font-semibold ${
                        room.bridgeMode === 'classic'
                          ? 'bg-emerald-400 text-slate-950'
                          : 'bg-white/10 text-white/75'
                      }`}
                    >
                      Дефолт
                    </button>
                  </div>
                </div>
              )}
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
                Гравці ({room.players.length}/{room.gameType === 'blackjack' || room.gameType === 'deberts' ? 4 : 6}):
              </span>
              {isHost && room.players.length < (room.gameType === 'blackjack' || room.gameType === 'deberts' ? 4 : 6) && (
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
                disabled={
                  room.players.length <
                  (room.gameType === 'spy' ? 3 : room.gameType === 'blackjack' ? 1 : 2)
                }
                onClick={onStartOnlineGame}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:pointer-events-none text-slate-950 font-extrabold text-sm shadow-lg active:scale-95 transition"
              >
                <Play className="w-4 h-4 fill-current" />
                {room.gameType === 'blackjack' && room.players.length === 1
                  ? 'Почати гру (Соло)'
                  : 'Почати гру'}
              </button>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-emerald-200/80 bg-white/5 rounded-xl px-3">
                Очікуємо старт від хоста...
              </div>
            )}
          </div>
        </div>
        {friendsModal}
        {showRoomChat && (
          <ChatDrawer
            title={`Чат кімнати ${room.code}`}
            myPlayerId={currentPlayerId}
            messages={roomChatMessages}
            onSend={(text) => onSendRoomChat(room.code, text)}
            onClose={() => setShowRoomChat(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="h-full felt-table flex flex-col items-center justify-start sm:justify-center p-3 sm:p-4 safe-top safe-bottom overflow-y-auto">
      <div className="w-full max-w-sm space-y-2.5 sm:space-y-3.5 pb-4">
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
          {connected && wallet && (
            <div className="flex items-center justify-center gap-3">
              {(!wallet.nextDailyAt || wallet.nextDailyAt <= Date.now()) ? (
                <button
                  type="button"
                  onClick={onClaimDailyBonus}
                  className="px-3 py-1 rounded-full bg-emerald-400/20 hover:bg-emerald-400/30 border border-emerald-400/40 text-[11px] font-extrabold text-emerald-200 animate-pulse"
                >
                  🎁 Бонус дня
                </button>
              ) : (
                <span className="text-[10px] text-white/45">
                  🎁 Бонус дня забрано
                </span>
              )}
              {wallet.chips < 100 && (
                <button
                  type="button"
                  onClick={onClaimBonus}
                  className="text-[11px] font-bold text-amber-300 underline"
                >
                  +200 рятівних
                </button>
              )}
            </div>
          )}
          {dailyRewardPopup !== null && (
            <div className="text-xs font-extrabold text-amber-300">
              🎉 Отримано +{dailyRewardPopup} фішок за Бонус дня!
            </div>
          )}
          <h1 className="text-3xl font-black tracking-tight text-white">
            {serverConfig.karasykBrandingEnabled ? 'Карасьовий Брідж' : 'Карткові Ігри'}
          </h1>
          <p className="text-xs text-emerald-200/75">
            {selectedGameType === 'durak'
              ? `Дурак (${selectedDurakMode === 'perevodnoy' ? 'Перевідний' : 'Підкидний'}) • 2–6 гравців`
              : selectedGameType === 'holdem'
                ? 'Покер на фішки • 2–6 гравців'
                : selectedGameType === 'blackjack'
                  ? 'Блекджек 21 • 1–4 гравці'
                  : selectedGameType === 'spy'
                    ? 'Шпигун • 3–6 гравців'
                    : selectedGameType === 'crocodile'
                      ? 'Крокодил (малювалка) • 2–6 гравців'
                      : selectedGameType === 'deberts'
                        ? 'Деберц • 2–4 гравці'
                        : `Брідж (${selectedBridgeMode === 'classic' ? 'Дефолт' : 'Калинівський'}) • 2–6 гравців`}
          </p>
          <div className="flex items-center justify-center flex-wrap gap-2 pt-1">
            {serverConfig.bridgeEnabled && (
              <button
                type="button"
                onClick={() => onSelectGameType('bridge')}
                className={`px-3.5 py-2 rounded-full text-xs font-extrabold transition ${
                  selectedGameType === 'bridge'
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-white/10 text-white/75 hover:bg-white/20'
                }`}
              >
                Брідж
              </button>
            )}
            {serverConfig.durakEnabled && (
              <button
                type="button"
                onClick={() => onSelectGameType('durak')}
                className={`px-3.5 py-2 rounded-full text-xs font-extrabold transition ${
                  selectedGameType === 'durak'
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-white/10 text-white/75 hover:bg-white/20'
                }`}
              >
                Дурак
              </button>
            )}
            {serverConfig.holdemEnabled && (
              <button
                type="button"
                onClick={() => onSelectGameType('holdem')}
                className={`px-3.5 py-2 rounded-full text-xs font-extrabold transition ${
                  selectedGameType === 'holdem'
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-white/10 text-white/75 hover:bg-white/20'
                }`}
              >
                Покер
              </button>
            )}
            {serverConfig.blackjackEnabled && (
              <button
                type="button"
                onClick={() => onSelectGameType('blackjack')}
                className={`px-3.5 py-2 rounded-full text-xs font-extrabold transition ${
                  selectedGameType === 'blackjack'
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-white/10 text-white/75 hover:bg-white/20'
                }`}
              >
                🃏 Блекджек
              </button>
            )}
            {serverConfig.spyEnabled && (
              <button
                type="button"
                onClick={() => onSelectGameType('spy')}
                className={`px-3.5 py-2 rounded-full text-xs font-extrabold transition ${
                  selectedGameType === 'spy'
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-white/10 text-white/75 hover:bg-white/20'
                }`}
              >
                🕵️ Шпигун
              </button>
            )}
            {serverConfig.crocodileEnabled && (
              <button
                type="button"
                onClick={() => onSelectGameType('crocodile')}
                className={`px-3.5 py-2 rounded-full text-xs font-extrabold transition ${
                  selectedGameType === 'crocodile'
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-white/10 text-white/75 hover:bg-white/20'
                }`}
              >
                🎨 Крокодил
              </button>
            )}
            {serverConfig.debertsEnabled && (
              <button
                type="button"
                onClick={() => onSelectGameType('deberts')}
                className={`px-3.5 py-2 rounded-full text-xs font-extrabold transition ${
                  selectedGameType === 'deberts'
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-white/10 text-white/75 hover:bg-white/20'
                }`}
              >
                🂡 Деберц
              </button>
            )}
            {connected && serverConfig.slotEnabled && (
              <button
                type="button"
                onClick={onOpenSlot}
                className="px-3.5 py-2 rounded-full bg-purple-500/35 hover:bg-purple-500/50 border border-purple-400/45 text-purple-100 text-xs font-extrabold transition active:scale-95"
              >
                🎰 Слот
              </button>
            )}
          </div>
          {selectedGameType === 'bridge' && (
            <div className="flex items-center justify-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => onSelectBridgeMode('kalynivskyi')}
                className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${
                  selectedBridgeMode === 'kalynivskyi'
                    ? 'bg-emerald-400 text-slate-950'
                    : 'bg-white/10 text-white/70'
                }`}
              >
                Калинівський
              </button>
              <button
                type="button"
                onClick={() => onSelectBridgeMode('classic')}
                className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${
                  selectedBridgeMode === 'classic'
                    ? 'bg-emerald-400 text-slate-950'
                    : 'bg-white/10 text-white/70'
                }`}
              >
                Дефолт
              </button>
            </div>
          )}
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
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              Кімната для гри
            </div>
            <div className="flex gap-1 text-[10px]">
              <button
                type="button"
                onClick={() => {
                  setRoomIsPublic(true);
                  setRoomPassword('');
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg font-bold ${
                  roomIsPublic ? 'bg-emerald-400 text-slate-950' : 'bg-white/10 text-white/75'
                }`}
              >
                <Globe className="w-3 h-3" />
                Відкрита
              </button>
              <button
                type="button"
                onClick={() => setRoomIsPublic(false)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg font-bold ${
                  !roomIsPublic ? 'bg-amber-400 text-slate-950' : 'bg-white/10 text-white/75'
                }`}
              >
                <Lock className="w-3 h-3" />
                Пароль
              </button>
            </div>
          </div>

          {!roomIsPublic && (
            <input
              type="text"
              value={roomPassword}
              maxLength={16}
              onChange={(e) => setRoomPassword(e.target.value)}
              placeholder="Пароль для входу (необов'язково)..."
              className="w-full px-3 py-2 rounded-xl bg-white/10 border border-amber-400/30 text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-400"
            />
          )}

          <button
            type="button"
            disabled={!connected}
            onClick={() => onCreateRoom(roomIsPublic, roomPassword.trim() || undefined)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-extrabold text-sm shadow-lg active:scale-95 transition"
          >
            <Plus className="w-4 h-4" />
            {selectedGameType === 'blackjack'
              ? 'Створити кімнату (з друзями / ботами)'
              : 'Створити кімнату'}
          </button>

          {selectedGameType === 'blackjack' && (
            <button
              type="button"
              disabled={!connected}
              onClick={onPlayBlackjackSolo}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/25 hover:bg-emerald-500/40 border border-emerald-400/45 disabled:opacity-40 text-emerald-100 font-extrabold text-xs active:scale-95 transition"
            >
              🃏 Грати в Блекджек соло
            </button>
          )}

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

        {/* Public Open Rooms */}
        {connected && (
          <div className="rounded-2xl bg-black/30 backdrop-blur-md border border-white/10 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-emerald-200 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                Відкриті кімнати ({publicRooms.length})
              </div>
              <button
                type="button"
                onClick={onRefreshPublicRooms}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-emerald-200 active:scale-95 transition"
                title="Оновити список кімнат"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            {publicRooms.length === 0 ? (
              <p className="text-[11px] text-white/50 text-center py-2">
                Наразі немає відкритих кімнат — створіть першу з перемикачем «Відкрита»!
              </p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {publicRooms.map((r) => (
                  <div
                    key={r.code}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span className="text-amber-300">{r.code}</span>
                        <span>•</span>
                        <span className="truncate">
                          {r.gameType === 'durak'
                            ? 'Дурак'
                            : r.gameType === 'holdem'
                              ? 'Покер'
                              : r.gameType === 'blackjack'
                                ? 'Блекджек 21'
                                : 'Брідж'}
                        </span>
                        {r.hasPassword && <Lock className="w-3 h-3 text-amber-300" />}
                      </div>
                      <div className="text-[10px] text-white/55">
                        Хост: {r.hostName} • {r.playerCount}/{r.maxPlayers}
                        {r.started ? ' • триває гра' : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (r.hasPassword) {
                          const pwd = window.prompt(`Введіть пароль для кімнати ${r.code}:`);
                          if (pwd !== null) onJoinRoom(r.code, pwd);
                        } else {
                          onJoinRoom(r.code);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-[11px]"
                    >
                      Увійти
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Local Training Mode */}
        {serverConfig.trainingEnabled && (
        <div className="rounded-2xl bg-black/25 backdrop-blur-md border border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <Eye className="w-4 h-4 text-sky-400" />
              Тренування (
              {selectedGameType === 'durak'
                ? 'Дурак'
                : selectedGameType === 'holdem'
                  ? 'Покер'
                  : 'Брідж'}
              )
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
            Локальний стіл на 2–6 гравців з відкритими картами для тренування (Брідж, Дурак, Покер — залежить від вибору гри зверху).
          </p>
          <button
            type="button"
            onClick={() => onStartSandbox(sandboxCount)}
            className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-sm active:scale-95 transition"
          >
            Тренування:{' '}
            {selectedGameType === 'durak'
              ? 'Дурак'
              : selectedGameType === 'holdem'
                ? 'Покер'
                : 'Брідж'}{' '}
            ({sandboxCount} гравці)
          </button>
        </div>
        )}
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
          <div className="w-full max-w-sm max-h-[85dvh] flex flex-col rounded-3xl bg-[#0b2919] border border-rose-400/40 p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-white">Адмін-панель</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAdmin(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Admin Tabs */}
            <div className="flex gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setAdminTab('chips')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold ${
                  adminTab === 'chips'
                    ? 'bg-rose-500 text-white'
                    : 'bg-white/10 text-white/75'
                }`}
              >
                🪙 Фішки
              </button>
              <button
                type="button"
                onClick={() => {
                  onFetchAdminWallets();
                  setAdminTab('rooms');
                }}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold ${
                  adminTab === 'rooms'
                    ? 'bg-rose-500 text-white'
                    : 'bg-white/10 text-white/75'
                }`}
              >
                🚪 Кімнати ({adminRooms.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  onFetchAdminWallets();
                  setAdminTab('notice');
                }}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold ${
                  adminTab === 'notice'
                    ? 'bg-rose-500 text-white'
                    : 'bg-white/10 text-white/75'
                }`}
              >
                ⚙️ Сервер ({adminOnlinePlayers.length})
              </button>
            </div>

            {adminTab === 'chips' && (
              <div className="space-y-3 overflow-y-auto">
                <div className="space-y-2">
                  <label className="block text-[11px] text-emerald-200/80">
                    Telegram ID (напр. `123456789` або `tg_123456789`):
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
                  <button
                    type="button"
                    onClick={() => onAdminGiftAll(500)}
                    className="w-full py-2 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-amber-200 font-bold text-xs active:scale-95 transition"
                  >
                    🎁 Роздати всім онлайн +500 фішок
                  </button>
                </div>

                <div className="space-y-1.5 max-h-56 overflow-y-auto pt-1 border-t border-white/10">
                  <div className="text-[10px] text-emerald-200/70">
                    Гравці з Telegram ({adminWallets.length}) — швидкі дії:
                  </div>
                  {adminWallets.length === 0 ? (
                    <div className="text-[11px] text-white/45 text-center py-3">
                      Поки немає гравців з Telegram ID.
                    </div>
                  ) : (
                    adminWallets.map((w) => (
                      <div
                        key={w.playerId}
                        className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs"
                      >
                        <button
                          type="button"
                          onClick={() => setAdminTargetId(w.playerId)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="font-semibold text-white truncate flex items-center gap-1">
                            <span>{w.name}</span>
                            {w.banned && (
                              <span className="px-1 py-0.2 rounded bg-rose-500/80 text-white text-[9px] font-bold">
                                БАН
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-white/50 truncate">
                            {w.playerId} • 🪙 {w.chips}
                          </div>
                        </button>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => onAdminAdjustChips(w.playerId, 500)}
                            className="px-2 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400/35 text-amber-200 text-[10px] font-extrabold"
                            title="Дати +500 фішок"
                          >
                            +500
                          </button>
                          <button
                            type="button"
                            onClick={() => onAdminAdjustChips(w.playerId, 1000)}
                            className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-200 text-[10px] font-extrabold"
                            title="Дати +1000 фішок"
                          >
                            +1000
                          </button>
                          {w.playerId !== currentPlayerId && (
                            <button
                              type="button"
                              onClick={() => onAdminSetBan(w.playerId, !w.banned)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-extrabold ${
                                w.banned
                                  ? 'bg-emerald-500 text-slate-950'
                                  : 'bg-rose-500/75 hover:bg-rose-500 text-white'
                              }`}
                            >
                              {w.banned ? 'Розбан' : 'Бан'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {adminTab === 'rooms' && (
              <div className="space-y-2 overflow-y-auto max-h-80">
                {adminRooms.length === 0 ? (
                  <p className="text-xs text-center text-white/50 py-6">
                    Наразі немає активних кімнат
                  </p>
                ) : (
                  adminRooms.map((r) => (
                    <div
                      key={r.code}
                      className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-white">
                          <span className="text-amber-300">{r.code}</span> •{' '}
                          {r.gameType === 'durak'
                            ? 'Дурак'
                            : r.gameType === 'holdem'
                              ? 'Покер'
                              : r.gameType === 'blackjack'
                                ? 'Блекджек 21'
                                : 'Брідж'}{' '}
                          {r.hasPassword ? '🔒' : r.isPublic ? '🌐' : '🔑'}
                        </div>
                        <button
                          type="button"
                          onClick={() => onAdminCloseRoom(r.code)}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/80 hover:bg-rose-500 text-white text-[11px] font-bold"
                        >
                          Закрити
                        </button>
                      </div>
                      <div className="space-y-1">
                        {r.players.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between px-2 py-1 rounded-lg bg-black/25 text-[11px]"
                          >
                            <span className="text-white/90 truncate">
                              {p.isBot ? '🤖 ' : ''}
                              {p.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => onAdminKickPlayer(r.code, p.id)}
                              className="px-2 py-0.5 rounded bg-white/10 hover:bg-rose-500/50 text-rose-200 text-[10px] font-bold"
                            >
                              Кікнути
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {adminTab === 'notice' && (
              <div className="space-y-3 overflow-y-auto max-h-80 pr-0.5">
                {/* Online players & Ban */}
                <div className="rounded-xl bg-white/5 border border-white/10 p-2.5 space-y-1.5">
                  <div className="text-[11px] font-bold text-emerald-200">
                    Зараз онлайн: {adminOnlinePlayers.length}
                  </div>
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {adminOnlinePlayers.map((op) => (
                      <div
                        key={op.playerId}
                        className="flex items-center justify-between px-2 py-1 rounded-lg bg-black/25 text-[11px]"
                      >
                        <span className="text-white truncate">{op.name}</span>
                        {op.playerId !== currentPlayerId && (
                          <button
                            type="button"
                            onClick={() => onAdminSetBan(op.playerId, !op.banned)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              op.banned
                                ? 'bg-emerald-500 text-slate-950'
                                : 'bg-rose-500/70 text-white'
                            }`}
                          >
                            {op.banned ? 'Розбан' : 'Бан'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Server Config: Games Visibility & Rewards */}
                <div className="rounded-xl bg-white/5 border border-white/10 p-2.5 space-y-2 text-xs">
                  <div className="text-[11px] font-bold text-white/90">
                    Видимість ігор (прибрати / показати):
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(
                      [
                        ['bridgeEnabled', 'Брідж'],
                        ['durakEnabled', 'Дурак'],
                        ['holdemEnabled', 'Покер'],
                        ['blackjackEnabled', '21'],
                        ['spyEnabled', 'Шпигун'],
                        ['crocodileEnabled', 'Крокодил'],
                        ['debertsEnabled', 'Деберц'],
                        ['slotEnabled', 'Слот'],
                        ['trainingEnabled', 'Тренування'],
                        ['karasykBrandingEnabled', 'Напис «Карась»'],
                        ['eightSplitEnabled', 'Ділення 8-ок'],
                      ] as const
                    ).map(([key, label]) => {
                      const active = serverConfig[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => onAdminUpdateConfig({ [key]: !active })}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                            active
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-rose-500/70 text-white line-through'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                    <div className="bg-black/25 rounded-lg p-1.5 text-center">
                      <div className="text-white/60">Брідж</div>
                      <button
                        type="button"
                        onClick={() =>
                          onAdminUpdateConfig({
                            bridgeRoundReward:
                              serverConfig.bridgeRoundReward >= 200
                                ? 50
                                : serverConfig.bridgeRoundReward + 50,
                          })
                        }
                        className="font-extrabold text-amber-300 underline mt-0.5"
                      >
                        +{serverConfig.bridgeRoundReward}
                      </button>
                    </div>
                    <div className="bg-black/25 rounded-lg p-1.5 text-center">
                      <div className="text-white/60">Дурак</div>
                      <button
                        type="button"
                        onClick={() =>
                          onAdminUpdateConfig({
                            durakWinReward:
                              serverConfig.durakWinReward >= 300
                                ? 50
                                : serverConfig.durakWinReward + 50,
                          })
                        }
                        className="font-extrabold text-amber-300 underline mt-0.5"
                      >
                        +{serverConfig.durakWinReward}
                      </button>
                    </div>
                    <div className="bg-black/25 rounded-lg p-1.5 text-center">
                      <div className="text-white/60">Покер BB</div>
                      <button
                        type="button"
                        onClick={() =>
                          onAdminUpdateConfig({
                            holdemBigBlind:
                              serverConfig.holdemBigBlind >= 100
                                ? 20
                                : serverConfig.holdemBigBlind + 20,
                          })
                        }
                        className="font-extrabold text-amber-300 underline mt-0.5"
                      >
                        {serverConfig.holdemBigBlind}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Broadcast Notice */}
                <div className="space-y-1.5">
                  <textarea
                    rows={2}
                    value={adminNoticeText}
                    onChange={(e) => setAdminNoticeText(e.target.value)}
                    placeholder="Оголошення всім онлайн..."
                    className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-xs text-white placeholder-white/40 focus:outline-none focus:border-rose-400"
                  />
                  <button
                    type="button"
                    disabled={!adminNoticeText.trim()}
                    onClick={() => {
                      onAdminBroadcast(adminNoticeText.trim());
                      setAdminNoticeText('');
                    }}
                    className="w-full py-2 rounded-xl bg-rose-500 hover:bg-rose-400 disabled:opacity-40 text-white font-bold text-xs"
                  >
                    📢 Надіслати всім онлайн
                  </button>
                </div>

                {/* Backup & Restore */}
                <div className="rounded-xl bg-white/5 border border-amber-400/30 p-2.5 space-y-2 text-xs">
                  <div className="text-[11px] font-bold text-amber-300">
                    💾 Резервна копія (фішки, друзі, бани, налаштування)
                  </div>
                  <button
                    type="button"
                    onClick={onAdminExportBackup}
                    className="w-full py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs"
                  >
                    📥 Створити бекап
                  </button>

                  {adminBackupJson && (
                    <div className="space-y-1.5">
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={async () => {
                            await copyTextToClipboard(adminBackupJson);
                            setBackupCopied(true);
                            window.setTimeout(() => setBackupCopied(false), 2000);
                          }}
                          className="flex-1 py-1.5 rounded-lg bg-emerald-500/80 hover:bg-emerald-500 text-slate-950 font-bold text-[11px]"
                        >
                          {backupCopied ? '✅ Скопійовано!' : '📋 Копіювати JSON'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const blob = new Blob([adminBackupJson], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `bridge-backup-${new Date().toISOString().slice(0, 10)}.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                          className="flex-1 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white font-bold text-[11px]"
                        >
                          ⬇️ Скачати .json
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="pt-1 border-t border-white/10 space-y-1.5">
                    <textarea
                      rows={2}
                      value={restoreText}
                      onChange={(e) => setRestoreText(e.target.value)}
                      placeholder="Вставте JSON бекапу сюди для відновлення..."
                      className="w-full px-2.5 py-1.5 rounded-lg bg-black/30 border border-white/15 text-[11px] text-white placeholder-white/40 focus:outline-none focus:border-amber-400"
                    />
                    <div className="flex gap-1.5">
                      <label className="flex-1 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-[11px] text-center cursor-pointer">
                        📂 Обрати .json
                        <input
                          type="file"
                          accept=".json,application/json"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            file.text().then((txt) => {
                              setRestoreText(txt);
                              onAdminImportBackup(txt);
                            });
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        disabled={!restoreText.trim()}
                        onClick={() => {
                          onAdminImportBackup(restoreText.trim());
                          setRestoreText('');
                        }}
                        className="flex-1 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-extrabold text-[11px]"
                      >
                        📤 Відновити
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
