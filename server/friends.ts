import type { FriendEntry, FriendRequestEntry } from '../src/shared/types';
import { normalizeTargetPlayerId } from './wallet';

const friendsMap = new Map<string, Set<string>>();
const requestsMap = new Map<string, FriendRequestEntry[]>();
const knownNames = new Map<string, string>();

export function registerPlayerName(playerId: string, name: string): void {
  if (name.trim()) {
    knownNames.set(playerId, name.trim());
  }
}

export function getFriendsState(
  playerId: string,
  onlineIds: Set<string>,
): { friends: FriendEntry[]; incomingRequests: FriendRequestEntry[] } {
  const friendIds = friendsMap.get(playerId) ?? new Set<string>();
  const friends: FriendEntry[] = Array.from(friendIds).map((fid) => ({
    playerId: fid,
    name: knownNames.get(fid) || fid,
    online: onlineIds.has(fid),
  }));
  const incomingRequests = requestsMap.get(playerId) ?? [];
  return { friends, incomingRequests };
}

export function sendFriendRequest(
  fromId: string,
  fromName: string,
  rawTargetId: string,
): { targetId: string; ok: boolean; error?: string } {
  const targetId = normalizeTargetPlayerId(rawTargetId);
  if (!targetId || targetId === fromId) {
    return { targetId, ok: false, error: 'Невірний ID гравця.' };
  }
  registerPlayerName(fromId, fromName);

  const existingFriends = friendsMap.get(fromId);
  if (existingFriends?.has(targetId)) {
    return { targetId, ok: false, error: 'Ви вже друзі!' };
  }

  const targetReqs = requestsMap.get(targetId) ?? [];
  if (!targetReqs.some((r) => r.fromId === fromId)) {
    targetReqs.push({ fromId, fromName });
    requestsMap.set(targetId, targetReqs);
  }
  return { targetId, ok: true };
}

export function respondFriendRequest(
  playerId: string,
  fromId: string,
  accept: boolean,
): void {
  const reqs = requestsMap.get(playerId) ?? [];
  requestsMap.set(
    playerId,
    reqs.filter((r) => r.fromId !== fromId),
  );

  if (accept) {
    if (!friendsMap.has(playerId)) friendsMap.set(playerId, new Set());
    if (!friendsMap.has(fromId)) friendsMap.set(fromId, new Set());
    friendsMap.get(playerId)!.add(fromId);
    friendsMap.get(fromId)!.add(playerId);
  }
}
