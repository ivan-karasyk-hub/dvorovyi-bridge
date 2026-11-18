import type {
  Card,
  DurakAction,
  DurakMode,
  DurakPlayer,
  DurakState,
  DurakTablePair,
  GameLogEntry,
  Rank,
  Suit,
} from './types';
import { createDeck, DURAK_RANKS, formatCard, shuffleDeck, SUIT_NAMES_UK } from './gameEngine';

const RANK_POWER: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

const MAX_LOGS = 20;

function makeLog(text: string, type: GameLogEntry['type'] = 'info'): GameLogEntry {
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    text,
    type,
    timestamp: Date.now(),
  };
}

function appendLogs(existing: GameLogEntry[], ...entries: GameLogEntry[]): GameLogEntry[] {
  return [...existing, ...entries].slice(-MAX_LOGS);
}

function nextActiveIndex(players: DurakPlayer[], fromIndex: number): number {
  const n = players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (fromIndex + i) % n;
    if (players[idx].finishedOrder === null) return idx;
  }
  return fromIndex;
}

function getActiveIndices(players: DurakPlayer[]): number[] {
  return players
    .map((p, idx) => (p.finishedOrder === null ? idx : -1))
    .filter((idx) => idx >= 0);
}

export function canDefendCard(attack: Card, defense: Card, trumpSuit: Suit): boolean {
  if (defense.suit === attack.suit) {
    return RANK_POWER[defense.rank] > RANK_POWER[attack.rank];
  }
  return defense.suit === trumpSuit && attack.suit !== trumpSuit;
}

export function canThrowCardInDurak(card: Card, playerIndex: number, state: DurakState): boolean {
  if (state.phase !== 'playing') return false;
  if (playerIndex === state.defenderIndex) return false;
  if (state.players[playerIndex]?.finishedOrder !== null) return false;

  const defender = state.players[state.defenderIndex];
  const undefendedCount = state.table.filter((p) => p.defense === null).length;

  // Cannot throw more cards than defender has in hand, or > 6 cards total on table
  if (state.table.length >= 6) return false;
  if (undefendedCount >= defender.hand.length) return false;

  if (state.table.length === 0) {
    return playerIndex === state.attackerIndex;
  }

  const tableRanks = new Set<Rank>();
  for (const pair of state.table) {
    tableRanks.add(pair.attack.rank);
    if (pair.defense) tableRanks.add(pair.defense.rank);
  }
  return tableRanks.has(card.rank);
}

export function canTransferCardInDurak(card: Card, playerIndex: number, state: DurakState): boolean {
  if (state.phase !== 'playing') return false;
  if (state.mode !== 'perevodnoy') return false;
  if (playerIndex !== state.defenderIndex) return false;
  if (state.defenderTaking) return false;
  if (state.table.length === 0) return false;
  if (state.table.some((p) => p.defense !== null)) return false;

  const targetRank = state.table[0].attack.rank;
  if (card.rank !== targetRank) return false;

  const nextDefIdx = nextActiveIndex(state.players, state.defenderIndex);
  if (nextDefIdx === state.defenderIndex) return false;
  return state.players[nextDefIdx].hand.length >= state.table.length + 1;
}

export function createDurakMatch(
  playerInfos: Array<{ id: string; name: string; isHost?: boolean; isBot?: boolean }>,
  mode: DurakMode = 'podkidnoy',
  rng: () => number = Math.random,
): DurakState {
  const deck = shuffleDeck(createDeck(DURAK_RANKS), rng);
  const trumpCard = deck[0] ?? null;
  const trumpSuit: Suit = trumpCard ? trumpCard.suit : 'spades';

  const players: DurakPlayer[] = playerInfos.map((info) => {
    const hand: Card[] = [];
    for (let i = 0; i < 6; i++) {
      const card = deck.pop();
      if (card) hand.push(card);
    }
    return {
      id: info.id,
      name: info.name,
      hand,
      isHost: info.isHost,
      isBot: info.isBot,
      connected: true,
      finishedOrder: null,
    };
  });

  // Find player with lowest trump card to go first
  let firstAttacker = 0;
  let lowestPower = 999;
  players.forEach((p, idx) => {
    for (const card of p.hand) {
      if (card.suit === trumpSuit && RANK_POWER[card.rank] < lowestPower) {
        lowestPower = RANK_POWER[card.rank];
        firstAttacker = idx;
      }
    }
  });

  const firstDefender = nextActiveIndex(players, firstAttacker);

  return {
    mode,
    players,
    deck,
    discardCount: 0,
    trumpSuit,
    trumpCard,
    attackerIndex: firstAttacker,
    defenderIndex: firstDefender,
    table: [],
    passedPlayerIds: [],
    defenderTaking: false,
    phase: 'playing',
    loserId: null,
    logs: [
      makeLog(
        `Дурак (${mode === 'perevodnoy' ? 'Перевідний' : 'Підкидний'}). Козир: ${SUIT_NAMES_UK[trumpSuit]}. Перший хід: ${players[firstAttacker].name}.`,
        'special',
      ),
    ],
  };
}

function finishBout(state: DurakState, logs: GameLogEntry[]): DurakState {
  const players = state.players.map((p) => ({ ...p, hand: [...p.hand] }));
  const deck = [...state.deck];
  let discardCount = state.discardCount;

  if (state.defenderTaking) {
    for (const pair of state.table) {
      players[state.defenderIndex].hand.push(pair.attack);
      if (pair.defense) players[state.defenderIndex].hand.push(pair.defense);
    }
    logs.push(makeLog(`${players[state.defenderIndex].name} забрав карти зі столу.`, 'warning'));
  } else {
    discardCount += state.table.reduce((sum, p) => sum + (p.defense ? 2 : 1), 0);
    logs.push(makeLog('Бито! Карти пішли у відбій.'));
  }

  // Draw up to 6 cards in order: attacker, other active attackers, then defender
  const drawOrder: number[] = [state.attackerIndex];
  for (let i = 1; i < players.length; i++) {
    const idx = (state.attackerIndex + i) % players.length;
    if (idx !== state.defenderIndex && players[idx].finishedOrder === null) {
      drawOrder.push(idx);
    }
  }
  drawOrder.push(state.defenderIndex);

  for (const idx of drawOrder) {
    while (players[idx].hand.length < 6 && deck.length > 0) {
      const card = deck.pop();
      if (card) players[idx].hand.push(card);
    }
  }

  // Mark players who emptied their hands (after deck is empty)
  let nextFinishOrder =
    players.reduce((max, p) => Math.max(max, p.finishedOrder ?? 0), 0) + 1;

  if (deck.length === 0) {
    for (const idx of drawOrder) {
      if (players[idx].hand.length === 0 && players[idx].finishedOrder === null) {
        players[idx].finishedOrder = nextFinishOrder++;
        logs.push(makeLog(`${players[idx].name} вийшов з гри!`, 'special'));
      }
    }
  }

  const remaining = getActiveIndices(players);
  if (remaining.length <= 1) {
    const loser = remaining.length === 1 ? players[remaining[0]] : null;
    if (loser) {
      logs.push(makeLog(`Гру завершено! Дурак: ${loser.name}`, 'bridge'));
    } else {
      logs.push(makeLog('Гру завершено! Нічия.', 'bridge'));
    }
    return {
      ...state,
      players,
      deck,
      trumpCard: deck.length > 0 ? state.trumpCard : null,
      discardCount,
      table: [],
      passedPlayerIds: [],
      defenderTaking: false,
      phase: 'round_over',
      loserId: loser?.id ?? null,
      logs: appendLogs(state.logs, ...logs),
    };
  }

  // Next attacker: if defender took, skip defender; otherwise defender becomes attacker
  const baseIdx = state.defenderTaking
    ? nextActiveIndex(players, state.defenderIndex)
    : players[state.defenderIndex].finishedOrder === null
      ? state.defenderIndex
      : nextActiveIndex(players, state.defenderIndex);

  const nextDef = nextActiveIndex(players, baseIdx);

  return {
    ...state,
    players,
    deck,
    trumpCard: deck.length > 0 ? state.trumpCard : null,
    discardCount,
    attackerIndex: baseIdx,
    defenderIndex: nextDef,
    table: [],
    passedPlayerIds: [],
    defenderTaking: false,
    logs: appendLogs(state.logs, ...logs),
  };
}

function checkAllAttackersPassed(state: DurakState): boolean {
  const active = getActiveIndices(state.players);
  const attackers = active.filter((idx) => idx !== state.defenderIndex);
  return attackers.every(
    (idx) =>
      state.passedPlayerIds.includes(state.players[idx].id) ||
      state.players[idx].hand.length === 0,
  );
}

export function applyDurakAction(
  state: DurakState,
  action: DurakAction,
  rng: () => number = Math.random,
): DurakState {
  if (action.type === 'NEW_DURAK_GAME') {
    return createDurakMatch(state.players, state.mode, rng);
  }

  if (state.phase !== 'playing') return state;

  const playerIdx = state.players.findIndex((p) => p.id === action.playerId);
  if (playerIdx < 0) return state;
  const player = state.players[playerIdx];

  switch (action.type) {
    case 'ATTACK': {
      const card = player.hand.find((c) => c.id === action.cardId);
      if (!card || !canThrowCardInDurak(card, playerIdx, state)) return state;

      const players = state.players.map((p, i) =>
        i === playerIdx ? { ...p, hand: p.hand.filter((c) => c.id !== card.id) } : p,
      );
      const table: DurakTablePair[] = [...state.table, { attack: card, defense: null }];
      const logs = [makeLog(`${player.name} підкинув ${formatCard(card)}`)];

      const nextState: DurakState = {
        ...state,
        players,
        table,
        passedPlayerIds: [],
        logs: appendLogs(state.logs, ...logs),
      };

      // If deck is empty and attacker emptied hand -> if all cards beaten or taking, check end
      if (state.deck.length === 0 && players[playerIdx].hand.length === 0) {
        if (state.defenderTaking) {
          return finishBout(nextState, []);
        }
      }
      return nextState;
    }

    case 'DEFEND': {
      if (playerIdx !== state.defenderIndex || state.defenderTaking) return state;
      const pair = state.table[action.attackIndex];
      if (!pair || pair.defense !== null) return state;
      const card = player.hand.find((c) => c.id === action.cardId);
      if (!card || !canDefendCard(pair.attack, card, state.trumpSuit)) return state;

      const players = state.players.map((p, i) =>
        i === playerIdx ? { ...p, hand: p.hand.filter((c) => c.id !== card.id) } : p,
      );
      const table = state.table.map((p, i) =>
        i === action.attackIndex ? { ...p, defense: card } : p,
      );
      const logs = [
        makeLog(`${player.name} відбив ${formatCard(pair.attack)} → ${formatCard(card)}`),
      ];

      const nextState: DurakState = {
        ...state,
        players,
        table,
        passedPlayerIds: [],
        logs: appendLogs(state.logs, ...logs),
      };

      // If defender has 0 cards left and all pairs are defended, bout ends immediately!
      if (players[playerIdx].hand.length === 0 && table.every((p) => p.defense !== null)) {
        return finishBout(nextState, []);
      }

      return nextState;
    }

    case 'TRANSFER': {
      const card = player.hand.find((c) => c.id === action.cardId);
      if (!card || !canTransferCardInDurak(card, playerIdx, state)) return state;

      const players = state.players.map((p, i) =>
        i === playerIdx ? { ...p, hand: p.hand.filter((c) => c.id !== card.id) } : p,
      );
      const table: DurakTablePair[] = [...state.table, { attack: card, defense: null }];
      const nextDef = nextActiveIndex(players, playerIdx);
      const logs = [
        makeLog(
          `${player.name} перевів ${formatCard(card)} на ${players[nextDef].name}!`,
          'special',
        ),
      ];

      return {
        ...state,
        players,
        table,
        attackerIndex: playerIdx,
        defenderIndex: nextDef,
        passedPlayerIds: [],
        logs: appendLogs(state.logs, ...logs),
      };
    }

    case 'TAKE_CARDS': {
      if (playerIdx !== state.defenderIndex || state.table.length === 0) return state;
      const nextState: DurakState = {
        ...state,
        defenderTaking: true,
        passedPlayerIds: [],
        logs: appendLogs(state.logs, makeLog(`${player.name} бере карти...`, 'warning')),
      };
      if (checkAllAttackersPassed(nextState)) {
        return finishBout(nextState, []);
      }
      return nextState;
    }

    case 'PASS_ATTACK': {
      if (playerIdx === state.defenderIndex || state.table.length === 0) return state;
      if (!state.defenderTaking && state.table.some((p) => p.defense === null)) {
        return state; // Cannot say "Бито" while undefended cards remain unless defender is taking
      }
      if (state.passedPlayerIds.includes(player.id)) return state;

      const passedPlayerIds = [...state.passedPlayerIds, player.id];
      const nextState: DurakState = {
        ...state,
        passedPlayerIds,
      };
      if (checkAllAttackersPassed(nextState)) {
        return finishBout(nextState, []);
      }
      return nextState;
    }
  }
}

export function chooseDurakBotAction(state: DurakState): DurakAction | null {
  if (state.phase !== 'playing') return null;

  // 1. Check defender bot
  const defender = state.players[state.defenderIndex];
  if (defender.isBot && !state.defenderTaking) {
    const undefendedIdx = state.table.findIndex((p) => p.defense === null);
    if (undefendedIdx >= 0) {
      // Check transfer first if perevodnoy
      for (const card of defender.hand) {
        if (canTransferCardInDurak(card, state.defenderIndex, state)) {
          return { type: 'TRANSFER', playerId: defender.id, cardId: card.id };
        }
      }
      // Find lowest valid defense card (prefer non-trump)
      const attackCard = state.table[undefendedIdx].attack;
      const valid = defender.hand
        .filter((c) => canDefendCard(attackCard, c, state.trumpSuit))
        .sort((a, b) => {
          const aTrump = a.suit === state.trumpSuit ? 1 : 0;
          const bTrump = b.suit === state.trumpSuit ? 1 : 0;
          if (aTrump !== bTrump) return aTrump - bTrump;
          return RANK_POWER[a.rank] - RANK_POWER[b.rank];
        });
      if (valid.length > 0) {
        return {
          type: 'DEFEND',
          playerId: defender.id,
          cardId: valid[0].id,
          attackIndex: undefendedIdx,
        };
      }
      return { type: 'TAKE_CARDS', playerId: defender.id };
    }
  }

  // 2. Check attacker/thrower bots
  const active = getActiveIndices(state.players);
  for (const idx of active) {
    if (idx === state.defenderIndex) continue;
    const p = state.players[idx];
    if (!p.isBot || state.passedPlayerIds.includes(p.id)) continue;

    // Try to throw lowest non-trump valid card (or trump only if empty table)
    const validThrows = p.hand
      .filter((c) => canThrowCardInDurak(c, idx, state))
      .sort((a, b) => {
        const aTrump = a.suit === state.trumpSuit ? 1 : 0;
        const bTrump = b.suit === state.trumpSuit ? 1 : 0;
        if (aTrump !== bTrump) return aTrump - bTrump;
        return RANK_POWER[a.rank] - RANK_POWER[b.rank];
      });

    if (validThrows.length > 0) {
      // Don't waste trumps just to throw onto a taking/defended table unless deck is empty
      const best = validThrows[0];
      if (state.table.length === 0 || best.suit !== state.trumpSuit || state.deck.length === 0) {
        return { type: 'ATTACK', playerId: p.id, cardId: best.id };
      }
    }

    if (state.table.length > 0 && (state.defenderTaking || state.table.every((pair) => pair.defense !== null))) {
      return { type: 'PASS_ATTACK', playerId: p.id };
    }
  }

  return null;
}

export function sanitizeDurakStateForPlayer(state: DurakState, viewerId: string): DurakState {
  if (state.phase === 'round_over') return state;
  return {
    ...state,
    deck: state.deck.map((c, i) =>
      i === 0 ? c : { id: `hidden_deck_${i}`, suit: 'spades', rank: '6' },
    ),
    players: state.players.map((p) =>
      p.id === viewerId
        ? p
        : {
            ...p,
            hand: p.hand.map((_, i) => ({
              id: `hidden_${p.id}_${i}`,
              suit: 'spades',
              rank: '6',
            })),
          },
    ),
  };
}
