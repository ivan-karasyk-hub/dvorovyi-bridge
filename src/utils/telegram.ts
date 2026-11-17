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
