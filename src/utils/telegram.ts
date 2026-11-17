interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  initDataUnsafe?: {
    start_param?: string;
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
    };
  };
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
  };
  openTelegramLink?: (url: string) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export function initTelegramApp(): void {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
  } catch {
    // Ignore outside Telegram
  }
}

export function getTelegramUser(): { id: string; name: string; avatarUrl?: string } | null {
  const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
  if (!user) return null;
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return {
    id: `tg_${user.id}`,
    name: fullName || user.username || 'Гравець',
    avatarUrl: user.photo_url,
  };
}

export function getStartRoomCode(): string | null {
  const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
  if (startParam && startParam.startsWith('room_')) {
    return startParam.replace('room_', '').toUpperCase();
  }
  const urlParams = new URLSearchParams(window.location.search);
  const room = urlParams.get('room');
  return room ? room.toUpperCase() : null;
}

export function triggerHaptic(style: 'light' | 'medium' | 'heavy' = 'light'): void {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(style);
  } catch {
    // Ignore outside Telegram
  }
}

export function getRoomInviteUrl(roomCode: string): string {
  const botUsername = import.meta.env.VITE_TG_BOT_USERNAME as string | undefined;
  const appShortName = import.meta.env.VITE_TG_APP_SHORT_NAME as string | undefined;
  if (botUsername) {
    const cleanBot = botUsername.replace(/^@/, '');
    if (appShortName) {
      return `https://t.me/${cleanBot}/${appShortName}?startapp=room_${roomCode}`;
    }
    return `https://t.me/${cleanBot}?startapp=room_${roomCode}`;
  }
  return `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
}

export function shareRoomInTelegram(roomCode: string): void {
  const inviteUrl = getRoomInviteUrl(roomCode);
  const text = `Залітай у Карасьовий Брідж! Код кімнати: ${roomCode}`;
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(text)}`;

  const tg = window.Telegram?.WebApp;
  if (tg?.openTelegramLink) {
    tg.openTelegramLink(shareUrl);
  } else {
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  }
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below for iOS WebView / Telegram Mini App
    }
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '-9999px';
    textarea.style.fontSize = '16px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function getOrCreateLocalPlayerId(): string {
  const tgUser = getTelegramUser();
  if (tgUser) return tgUser.id;
  const key = 'bridge_player_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = `p_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(key, id);
  }
  return id;
}
