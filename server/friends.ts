import type { FriendEntry, FriendRequestEntry } from '../src/shared/types';
import { hasSupabase, normalizeTargetPlayerId, supabaseFetch } from './wallet';

const friendsMap = new Map<string, Set<string>>();
const requestsMap = new Map<string, FriendRequestEntry[]>();
const knownNames = new Map<string, string>();

export function registerPlayerName(playerId: string, name: string): void {
  if (name.trim()) {
    knownNames.set(playerId, name.trim());
  }
}

export function getKnownPlayerName(playerId: string): string {
  return knownNames.get(playerId) || playerId;
}

export async function getFriendsState(
  playerId: string,
  onlineIds: Set<string>,
): Promise<{ friends: FriendEntry[]; incomingRequests: FriendRequestEntry[] }> {
  if (hasSupabase()) {
    try {
      const fRes = await supabaseFetch(
        `friends?or=(player_a.eq.${encodeURIComponent(playerId)},player_b.eq.${encodeURIComponent(playerId)})&select=*`,
      );
      const rRes = await supabaseFetch(
        `friend_requests?to_id.eq.${encodeURIComponent(playerId)}&select=*`,
      );
      if (fRes.ok && rRes.ok) {
        const fRows = (await fRes.json()) as Array<{
          player_a: string;
          player_b: string;
          name_a?: string;
          name_b?: string;
        }>;
        const rRows = (await rRes.json()) as Array<{
          from_id: string;
          from_name: string;
        }>;
        const friends: FriendEntry[] = fRows.map((row) => {
          const isA = row.player_a === playerId;
          const fid = isA ? row.player_b : row.player_a;
          const fname = isA
            ? row.name_b || knownNames.get(fid) || fid
            : row.name_a || knownNames.get(fid) || fid;
          return { playerId: fid, name: fname, online: onlineIds.has(fid) };
        });
        const incomingRequests: FriendRequestEntry[] = rRows.map((r) => ({
          fromId: r.from_id,
          fromName: r.from_name,
        }));
        return { friends, incomingRequests };
      }
    } catch {
      // Fallback to in-memory store
    }
  }

  const friendIds = friendsMap.get(playerId) ?? new Set<string>();
  const friends: FriendEntry[] = Array.from(friendIds).map((fid) => ({
    playerId: fid,
    name: knownNames.get(fid) || fid,
    online: onlineIds.has(fid),
  }));
  const incomingRequests = requestsMap.get(playerId) ?? [];
  return { friends, incomingRequests };
}

export async function sendFriendRequest(
  fromId: string,
  fromName: string,
  rawTargetId: string,
): Promise<{ targetId: string; ok: boolean; error?: string }> {
  const targetId = normalizeTargetPlayerId(rawTargetId);
  if (!targetId || targetId === fromId) {
    return { targetId, ok: false, error: 'Невірний ID гравця.' };
  }
  registerPlayerName(fromId, fromName);

  const existingFriends = friendsMap.get(fromId);
  if (existingFriends?.has(targetId)) {
    return { targetId, ok: false, error: 'Ви вже друзі!' };
  }

  if (hasSupabase()) {
    try {
      await supabaseFetch('friend_requests', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicates' },
        body: JSON.stringify({
          from_id: fromId,
          from_name: fromName,
          to_id: targetId,
        }),
      });
    } catch {
      // Fallback below
    }
  }

  const targetReqs = requestsMap.get(targetId) ?? [];
  if (!targetReqs.some((r) => r.fromId === fromId)) {
    targetReqs.push({ fromId, fromName });
    requestsMap.set(targetId, targetReqs);
  }
  return { targetId, ok: true };
}

export async function respondFriendRequest(
  playerId: string,
  playerName: string,
  fromId: string,
  accept: boolean,
): Promise<void> {
  const reqs = requestsMap.get(playerId) ?? [];
  requestsMap.set(
    playerId,
    reqs.filter((r) => r.fromId !== fromId),
  );

  if (hasSupabase()) {
    try {
      await supabaseFetch(
        `friend_requests?from_id.eq.${encodeURIComponent(fromId)}&to_id.eq.${encodeURIComponent(playerId)}`,
        { method: 'DELETE' },
      );
      if (accept) {
        const [a, b] = playerId < fromId ? [playerId, fromId] : [fromId, playerId];
        const nameA = a === playerId ? playerName : knownNames.get(a) || a;
        const nameB = b === playerId ? playerName : knownNames.get(b) || b;
        await supabaseFetch('friends', {
          method: 'POST',
          headers: { Prefer: 'resolution=ignore-duplicates' },
          body: JSON.stringify({
            player_a: a,
            player_b: b,
            name_a: nameA,
            name_b: nameB,
          }),
        });
      }
    } catch {
      // Fallback below
    }
  }

  if (accept) {
    if (!friendsMap.has(playerId)) friendsMap.set(playerId, new Set());
    if (!friendsMap.has(fromId)) friendsMap.set(fromId, new Set());
    friendsMap.get(playerId)!.add(fromId);
    friendsMap.get(fromId)!.add(playerId);
  }
}

export interface FriendsBackupSnapshot {
  pairs: Array<[string, string]>;
  requests: Array<[string, FriendRequestEntry[]]>;
  names: Array<[string, string]>;
}

export async function exportFriendsSnapshot(): Promise<FriendsBackupSnapshot> {
  const pairSet = new Set<string>();
  const pairs: Array<[string, string]> = [];
  for (const [a, set] of friendsMap.entries()) {
    for (const b of set) {
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (!pairSet.has(key)) {
        pairSet.add(key);
        pairs.push(a < b ? [a, b] : [b, a]);
      }
    }
  }

  if (hasSupabase()) {
    try {
      const fRes = await supabaseFetch('friends?select=*&limit=5000');
      if (fRes.ok) {
        const rows = (await fRes.json()) as Array<{
          player_a: string;
          player_b: string;
          name_a?: string;
          name_b?: string;
        }>;
        for (const r of rows) {
          if (r.name_a) knownNames.set(r.player_a, r.name_a);
          if (r.name_b) knownNames.set(r.player_b, r.name_b);
          const key = r.player_a < r.player_b ? `${r.player_a}|${r.player_b}` : `${r.player_b}|${r.player_a}`;
          if (!pairSet.has(key)) {
            pairSet.add(key);
            pairs.push([r.player_a, r.player_b]);
          }
        }
      }
    } catch {
      // Fallback to in-memory
    }
  }

  return {
    pairs,
    requests: Array.from(requestsMap.entries()),
    names: Array.from(knownNames.entries()),
  };
}

export async function importFriendsSnapshot(snapshot: FriendsBackupSnapshot): Promise<void> {
  if (!snapshot || typeof snapshot !== 'object') return;
  if (Array.isArray(snapshot.names)) {
    for (const [id, name] of snapshot.names) {
      if (typeof id === 'string' && typeof name === 'string') knownNames.set(id, name);
    }
  }
  if (Array.isArray(snapshot.requests)) {
    for (const [toId, list] of snapshot.requests) {
      if (typeof toId === 'string' && Array.isArray(list)) requestsMap.set(toId, list);
    }
  }
  if (Array.isArray(snapshot.pairs)) {
    for (const [a, b] of snapshot.pairs) {
      if (typeof a !== 'string' || typeof b !== 'string') continue;
      if (!friendsMap.has(a)) friendsMap.set(a, new Set());
      if (!friendsMap.has(b)) friendsMap.set(b, new Set());
      friendsMap.get(a)!.add(b);
      friendsMap.get(b)!.add(a);
      if (hasSupabase()) {
        try {
          const [pa, pb] = a < b ? [a, b] : [b, a];
          await supabaseFetch('friends', {
            method: 'POST',
            headers: { Prefer: 'resolution=ignore-duplicates' },
            body: JSON.stringify({
              player_a: pa,
              player_b: pb,
              name_a: knownNames.get(pa) || pa,
              name_b: knownNames.get(pb) || pb,
            }),
          });
        } catch {
          // Ignore
        }
      }
    }
  }
}
