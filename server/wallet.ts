export interface WalletProfile {
  playerId: string;
  name: string;
  chips: number;
  wins: number;
  updatedAt: number;
}

const STARTING_CHIPS = 1000;
const SUPABASE_URL = process.env.SUPABASE_URL
  ?.replace(/\/+$/, '')
  .replace(/\/rest\/v1$/, '');
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

export function isAdminPlayer(playerId: string): boolean {
  const adminRaw = process.env.ADMIN_TG_ID?.trim();
  if (!adminRaw) return false;
  const normalizedAdmin = adminRaw.startsWith('tg_') ? adminRaw : `tg_${adminRaw}`;
  return playerId === adminRaw || playerId === normalizedAdmin;
}

export function normalizeTargetPlayerId(rawId: string): string {
  const trimmed = rawId.trim();
  if (/^\d+$/.test(trimmed)) {
    return `tg_${trimmed}`;
  }
  return trimmed;
}

const memoryStore = new Map<string, WalletProfile>();

function hasSupabase(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

async function supabaseFetch(path: string, init?: RequestInit): Promise<Response> {
  const isJwt = SUPABASE_KEY!.startsWith('eyJ');
  const authHeaders: Record<string, string> = isJwt
    ? { apikey: SUPABASE_KEY!, Authorization: `Bearer ${SUPABASE_KEY!}` }
    : { apikey: SUPABASE_KEY! };

  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
}

export async function getOrCreateWallet(
  playerId: string,
  name: string,
): Promise<WalletProfile> {
  // Bots don't need persistent wallets
  if (playerId.startsWith('bot_')) {
    return { playerId, name, chips: STARTING_CHIPS, wins: 0, updatedAt: Date.now() };
  }

  if (hasSupabase()) {
    try {
      const res = await supabaseFetch(
        `wallets?player_id=eq.${encodeURIComponent(playerId)}&select=*`,
      );
      if (res.ok) {
        const rows = (await res.json()) as Array<{
          player_id: string;
          name: string;
          chips: number;
          wins: number;
          updated_at: string;
        }>;
        if (rows.length > 0) {
          const r = rows[0];
          const profile: WalletProfile = {
            playerId: r.player_id,
            name: name || r.name,
            chips: r.chips,
            wins: r.wins,
            updatedAt: Date.now(),
          };
          memoryStore.set(playerId, profile);
          return profile;
        }
        // Insert new player
        const insertRes = await supabaseFetch('wallets', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            player_id: playerId,
            name: name || 'Гравець',
            chips: STARTING_CHIPS,
            wins: 0,
          }),
        });
        if (insertRes.ok) {
          const created: WalletProfile = {
            playerId,
            name: name || 'Гравець',
            chips: STARTING_CHIPS,
            wins: 0,
            updatedAt: Date.now(),
          };
          memoryStore.set(playerId, created);
          return created;
        }
      }
    } catch {
      // Fallback to memory store on transient network error
    }
  }

  const existing = memoryStore.get(playerId);
  if (existing) {
    if (name) existing.name = name;
    return existing;
  }

  const fresh: WalletProfile = {
    playerId,
    name: name || 'Гравець',
    chips: STARTING_CHIPS,
    wins: 0,
    updatedAt: Date.now(),
  };
  memoryStore.set(playerId, fresh);
  return fresh;
}

export async function addChips(
  playerId: string,
  name: string,
  delta: number,
  incrementWin = false,
): Promise<WalletProfile> {
  const current = await getOrCreateWallet(playerId, name);
  if (playerId.startsWith('bot_')) return current;

  const nextChips = Math.max(0, current.chips + delta);
  const nextWins = current.wins + (incrementWin ? 1 : 0);
  const updated: WalletProfile = {
    playerId,
    name: name || current.name,
    chips: nextChips,
    wins: nextWins,
    updatedAt: Date.now(),
  };
  memoryStore.set(playerId, updated);

  if (hasSupabase()) {
    try {
      await supabaseFetch(
        `wallets?player_id=eq.${encodeURIComponent(playerId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: updated.name,
            chips: updated.chips,
            wins: updated.wins,
            updated_at: new Date().toISOString(),
          }),
        },
      );
    } catch {
      // Ignore transient DB error
    }
  }

  return updated;
}

export async function claimRescueBonus(
  playerId: string,
  name: string,
): Promise<{ granted: boolean; profile: WalletProfile }> {
  const current = await getOrCreateWallet(playerId, name);
  if (current.chips >= 100) {
    return { granted: false, profile: current };
  }
  const profile = await addChips(playerId, name, 200, false);
  return { granted: true, profile };
}

export async function getLeaderboard(limit = 10): Promise<WalletProfile[]> {
  if (hasSupabase()) {
    try {
      const res = await supabaseFetch(
        `wallets?select=*&order=chips.desc&limit=${limit}`,
      );
      if (res.ok) {
        const rows = (await res.json()) as Array<{
          player_id: string;
          name: string;
          chips: number;
          wins: number;
          updated_at: string;
        }>;
        return rows.map((r) => ({
          playerId: r.player_id,
          name: r.name,
          chips: r.chips,
          wins: r.wins,
          updatedAt: Date.parse(r.updated_at) || Date.now(),
        }));
      }
    } catch {
      // Fallback to memory store
    }
  }

  return Array.from(memoryStore.values())
    .sort((a, b) => b.chips - a.chips)
    .slice(0, limit);
}
