import type {
  GameLogEntry,
  HoldemAction,
  HoldemCard,
  HoldemPlayer,
  HoldemRank,
  HoldemState,
  HoldemStreet,
} from './types';
import { SUITS, SUIT_SYMBOLS } from './gameEngine';

export const HOLDEM_RANKS: HoldemRank[] = [
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
  'A',
];

const RANK_VALUE: Record<HoldemRank, number> = {
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

function makeLog(text: string, type: GameLogEntry['type'] = 'info'): GameLogEntry {
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    text,
    type,
    timestamp: Date.now(),
  };
}

function appendLogs(existing: GameLogEntry[], ...entries: GameLogEntry[]): GameLogEntry[] {
  return [...existing, ...entries].slice(-20);
}

export function formatHoldemCard(card: HoldemCard): string {
  return `${card.rank}${SUIT_SYMBOLS[card.suit]}`;
}

export function createHoldemDeck(rng: () => number = Math.random): HoldemCard[] {
  const deck: HoldemCard[] = [];
  for (const suit of SUITS) {
    for (const rank of HOLDEM_RANKS) {
      deck.push({ id: `${rank}_${suit}`, suit, rank });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export interface HandEval {
  category: number; // 0=HighCard .. 8=StraightFlush, 9=RoyalFlush
  tiebreakers: number[];
  name: string;
}

function compareEval(a: HandEval, b: HandEval): number {
  if (a.category !== b.category) return a.category - b.category;
  const len = Math.max(a.tiebreakers.length, b.tiebreakers.length);
  for (let i = 0; i < len; i++) {
    const diff = (a.tiebreakers[i] ?? 0) - (b.tiebreakers[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function evalFiveCards(cards: HoldemCard[]): HandEval {
  const values = cards.map((c) => RANK_VALUE[c.rank]).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const isFlush = suits.every((s) => s === suits[0]);

  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const groups = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  // Straight check
  const uniqueDesc = Array.from(new Set(values)).sort((a, b) => b - a);
  let straightHigh = 0;
  if (uniqueDesc.length === 5) {
    if (uniqueDesc[0] - uniqueDesc[4] === 4) {
      straightHigh = uniqueDesc[0];
    } else if (
      uniqueDesc[0] === 14 &&
      uniqueDesc[1] === 5 &&
      uniqueDesc[2] === 4 &&
      uniqueDesc[3] === 3 &&
      uniqueDesc[4] === 2
    ) {
      straightHigh = 5; // Wheel A-2-3-4-5
    }
  }

  if (isFlush && straightHigh > 0) {
    if (straightHigh === 14) {
      return { category: 9, tiebreakers: [14], name: 'Роял-флеш' };
    }
    return { category: 8, tiebreakers: [straightHigh], name: 'Стріт-флеш' };
  }
  if (groups[0][1] === 4) {
    return {
      category: 7,
      tiebreakers: [groups[0][0], groups[1][0]],
      name: 'Каре',
    };
  }
  if (groups[0][1] === 3 && groups[1][1] === 2) {
    return {
      category: 6,
      tiebreakers: [groups[0][0], groups[1][0]],
      name: 'Фул-хаус',
    };
  }
  if (isFlush) {
    return { category: 5, tiebreakers: values, name: 'Флеш' };
  }
  if (straightHigh > 0) {
    return { category: 4, tiebreakers: [straightHigh], name: 'Стріт' };
  }
  if (groups[0][1] === 3) {
    const kickers = groups.slice(1).map((g) => g[0]);
    return { category: 3, tiebreakers: [groups[0][0], ...kickers], name: 'Сет' };
  }
  if (groups[0][1] === 2 && groups[1][1] === 2) {
    return {
      category: 2,
      tiebreakers: [groups[0][0], groups[1][0], groups[2][0]],
      name: 'Дві пари',
    };
  }
  if (groups[0][1] === 2) {
    const kickers = groups.slice(1).map((g) => g[0]);
    return { category: 1, tiebreakers: [groups[0][0], ...kickers], name: 'Пара' };
  }
  return { category: 0, tiebreakers: values, name: 'Старша карта' };
}

export function evaluateBestHand(cards: HoldemCard[]): HandEval {
  if (cards.length < 5) {
    return { category: 0, tiebreakers: [], name: 'Старша карта' };
  }
  let best: HandEval | null = null;
  const n = cards.length;
  for (let a = 0; a < n - 4; a++) {
    for (let b = a + 1; b < n - 3; b++) {
      for (let c = b + 1; c < n - 2; c++) {
        for (let d = c + 1; d < n - 1; d++) {
          for (let e = d + 1; e < n; e++) {
            const ev = evalFiveCards([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (!best || compareEval(ev, best) > 0) {
              best = ev;
            }
          }
        }
      }
    }
  }
  return best!;
}

function nextActingPlayer(players: HoldemPlayer[], fromIdx: number): number {
  const n = players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (fromIdx + i) % n;
    const p = players[idx];
    if (!p.folded && !p.allIn && p.chips > 0) return idx;
  }
  return -1;
}

function dealHoldemHand(
  basePlayers: HoldemPlayer[],
  dealerIndex: number,
  smallBlind: number,
  bigBlind: number,
  rng: () => number,
): HoldemState {
  const deck = createHoldemDeck(rng);
  const players: HoldemPlayer[] = basePlayers.map((p) => {
    const hand: HoldemCard[] = [];
    if (p.chips > 0) {
      const c1 = deck.pop();
      const c2 = deck.pop();
      if (c1) hand.push(c1);
      if (c2) hand.push(c2);
    }
    return {
      ...p,
      hand,
      currentBet: 0,
      totalBetInHand: 0,
      folded: p.chips <= 0,
      allIn: false,
      actedThisStreet: false,
    };
  });

  const activeIndices = players
    .map((p, i) => (!p.folded ? i : -1))
    .filter((i) => i >= 0);

  if (activeIndices.length < 2) {
    return {
      players,
      deck,
      communityCards: [],
      pot: 0,
      dealerIndex,
      currentPlayerIndex: 0,
      street: 'showdown',
      currentMaxBet: 0,
      minRaise: bigBlind,
      smallBlind,
      bigBlind,
      winnerIds: activeIndices.map((i) => players[i].id),
      winningHandName: 'Недостатньо фішок у суперників',
      logs: [makeLog('Недостатньо гравців з фішками для нової роздачі.', 'warning')],
    };
  }

  const sbIdx =
    activeIndices.length === 2
      ? dealerIndex
      : activeIndices[(activeIndices.indexOf(dealerIndex) + 1) % activeIndices.length] ??
        activeIndices[0];
  const bbIdx =
    activeIndices[(activeIndices.indexOf(sbIdx) + 1) % activeIndices.length] ?? activeIndices[1];

  let pot = 0;
  const sbAmount = Math.min(smallBlind, players[sbIdx].chips);
  players[sbIdx].chips -= sbAmount;
  players[sbIdx].currentBet = sbAmount;
  players[sbIdx].totalBetInHand = sbAmount;
  if (players[sbIdx].chips === 0) players[sbIdx].allIn = true;
  pot += sbAmount;

  const bbAmount = Math.min(bigBlind, players[bbIdx].chips);
  players[bbIdx].chips -= bbAmount;
  players[bbIdx].currentBet = bbAmount;
  players[bbIdx].totalBetInHand = bbAmount;
  if (players[bbIdx].chips === 0) players[bbIdx].allIn = true;
  pot += bbAmount;

  const firstToAct = nextActingPlayer(players, bbIdx);

  return {
    players,
    deck,
    communityCards: [],
    pot,
    dealerIndex,
    currentPlayerIndex: firstToAct >= 0 ? firstToAct : sbIdx,
    street: 'preflop',
    currentMaxBet: bbAmount,
    minRaise: bigBlind,
    smallBlind,
    bigBlind,
    winnerIds: [],
    winningHandName: null,
    logs: [
      makeLog(
        `Нова роздача! Блайнди ${sbAmount}/${bbAmount}. Хід: ${players[firstToAct >= 0 ? firstToAct : sbIdx].name}.`,
        'special',
      ),
    ],
  };
}

export function createHoldemMatch(
  playerInfos: Array<{ id: string; name: string; chips?: number; isHost?: boolean; isBot?: boolean }>,
  rng: () => number = Math.random,
): HoldemState {
  const players: HoldemPlayer[] = playerInfos.map((info) => ({
    id: info.id,
    name: info.name,
    hand: [],
    chips: info.chips ?? 1000,
    currentBet: 0,
    totalBetInHand: 0,
    folded: false,
    allIn: false,
    actedThisStreet: false,
    isHost: info.isHost,
    isBot: info.isBot,
    connected: true,
  }));

  return dealHoldemHand(players, 0, 10, 20, rng);
}

function resolveShowdown(state: HoldemState, logs: GameLogEntry[]): HoldemState {
  const contenders = state.players.filter((p) => !p.folded);
  const players = state.players.map((p) => ({ ...p }));
  let communityCards = [...state.communityCards];
  const deck = [...state.deck];

  // Deal remaining community cards if all-in early
  while (communityCards.length < 5 && deck.length > 0 && contenders.length > 1) {
    const c = deck.pop();
    if (c) communityCards.push(c);
  }

  let winnerIds: string[] = [];
  let winningHandName = 'Перемога без розкриття';

  if (contenders.length === 1) {
    winnerIds = [contenders[0].id];
  } else {
    let bestEval: HandEval | null = null;
    for (const p of contenders) {
      const ev = evaluateBestHand([...p.hand, ...communityCards]);
      if (!bestEval) {
        bestEval = ev;
        winnerIds = [p.id];
      } else {
        const cmp = compareEval(ev, bestEval);
        if (cmp > 0) {
          bestEval = ev;
          winnerIds = [p.id];
        } else if (cmp === 0) {
          winnerIds.push(p.id);
        }
      }
    }
    winningHandName = bestEval?.name ?? 'Старша карта';
  }

  const share = Math.floor(state.pot / Math.max(1, winnerIds.length));
  const remainder = state.pot - share * winnerIds.length;
  winnerIds.forEach((wid, idx) => {
    const target = players.find((p) => p.id === wid);
    if (target) {
      target.chips += share + (idx === 0 ? remainder : 0);
    }
  });

  const winnerNames = winnerIds
    .map((id) => players.find((p) => p.id === id)?.name)
    .filter(Boolean)
    .join(', ');

  logs.push(
    makeLog(
      `${winnerNames} забирає банк ${state.pot} (${winningHandName})!`,
      'bridge',
    ),
  );

  return {
    ...state,
    players,
    deck,
    communityCards,
    street: 'showdown',
    winnerIds,
    winningHandName,
    logs: appendLogs(state.logs, ...logs),
  };
}

function advanceStreetOrTurn(state: HoldemState, logs: GameLogEntry[]): HoldemState {
  const notFolded = state.players.filter((p) => !p.folded);
  if (notFolded.length <= 1) {
    return resolveShowdown(state, logs);
  }

  const playersNeedAction = state.players.filter(
    (p) => !p.folded && !p.allIn && (!p.actedThisStreet || p.currentBet < state.currentMaxBet),
  );

  if (playersNeedAction.length > 0) {
    const nextIdx = nextActingPlayer(state.players, state.currentPlayerIndex);
    if (nextIdx >= 0) {
      return {
        ...state,
        currentPlayerIndex: nextIdx,
        logs: appendLogs(state.logs, ...logs),
      };
    }
  }

  // Street is complete -> move to next street or showdown
  if (state.street === 'river') {
    return resolveShowdown(state, logs);
  }

  const deck = [...state.deck];
  const communityCards = [...state.communityCards];
  let nextStreet: HoldemStreet = 'flop';

  if (state.street === 'preflop') {
    nextStreet = 'flop';
    for (let i = 0; i < 3; i++) {
      const c = deck.pop();
      if (c) communityCards.push(c);
    }
  } else if (state.street === 'flop') {
    nextStreet = 'turn';
    const c = deck.pop();
    if (c) communityCards.push(c);
  } else if (state.street === 'turn') {
    nextStreet = 'river';
    const c = deck.pop();
    if (c) communityCards.push(c);
  }

  const players = state.players.map((p) => ({
    ...p,
    currentBet: 0,
    actedThisStreet: false,
  }));

  const actingCount = players.filter((p) => !p.folded && !p.allIn && p.chips > 0).length;
  if (actingCount <= 1) {
    return resolveShowdown(
      {
        ...state,
        players,
        deck,
        communityCards,
        street: nextStreet,
        currentMaxBet: 0,
      },
      logs,
    );
  }

  const firstIdx = nextActingPlayer(players, state.dealerIndex);
  logs.push(makeLog(`Відкрито ${nextStreet.toUpperCase()}.`, 'special'));

  return {
    ...state,
    players,
    deck,
    communityCards,
    street: nextStreet,
    currentMaxBet: 0,
    minRaise: state.bigBlind,
    currentPlayerIndex: firstIdx >= 0 ? firstIdx : 0,
    logs: appendLogs(state.logs, ...logs),
  };
}

export function applyHoldemAction(
  state: HoldemState,
  action: HoldemAction,
  rng: () => number = Math.random,
): HoldemState {
  if (action.type === 'HOLDEM_NEXT_HAND') {
    if (state.street !== 'showdown') return state;
    const nextDealer = (state.dealerIndex + 1) % state.players.length;
    return dealHoldemHand(state.players, nextDealer, state.smallBlind, state.bigBlind, rng);
  }

  if (state.street === 'showdown') return state;
  const active = state.players[state.currentPlayerIndex];
  if (!active || active.id !== action.playerId) return state;

  const players = state.players.map((p) => ({ ...p }));
  const p = players[state.currentPlayerIndex];
  let pot = state.pot;
  let currentMaxBet = state.currentMaxBet;
  let minRaise = state.minRaise;
  const logs: GameLogEntry[] = [];

  switch (action.type) {
    case 'HOLDEM_FOLD': {
      p.folded = true;
      p.actedThisStreet = true;
      logs.push(makeLog(`${p.name} скинув карти (Fold).`));
      break;
    }

    case 'HOLDEM_CHECK_CALL': {
      const toCall = Math.min(p.chips, Math.max(0, currentMaxBet - p.currentBet));
      p.chips -= toCall;
      p.currentBet += toCall;
      p.totalBetInHand += toCall;
      pot += toCall;
      if (p.chips === 0) p.allIn = true;
      p.actedThisStreet = true;
      logs.push(makeLog(toCall === 0 ? `${p.name} Чек.` : `${p.name} Колл ${toCall}.`));
      break;
    }

    case 'HOLDEM_RAISE': {
      const targetBet = Math.max(currentMaxBet + minRaise, action.amount);
      const needed = Math.min(p.chips, Math.max(0, targetBet - p.currentBet));
      p.chips -= needed;
      p.currentBet += needed;
      p.totalBetInHand += needed;
      pot += needed;
      if (p.currentBet > currentMaxBet) {
        minRaise = Math.max(minRaise, p.currentBet - currentMaxBet);
        currentMaxBet = p.currentBet;
      }
      if (p.chips === 0) p.allIn = true;
      p.actedThisStreet = true;
      logs.push(makeLog(`${p.name} підняв до ${p.currentBet}!`, 'special'));
      break;
    }

    case 'HOLDEM_ALL_IN': {
      const needed = p.chips;
      p.chips = 0;
      p.currentBet += needed;
      p.totalBetInHand += needed;
      pot += needed;
      p.allIn = true;
      p.actedThisStreet = true;
      if (p.currentBet > currentMaxBet) {
        minRaise = Math.max(minRaise, p.currentBet - currentMaxBet);
        currentMaxBet = p.currentBet;
      }
      logs.push(makeLog(`${p.name} іде ALL-IN (${p.currentBet})!`, 'special'));
      break;
    }
  }

  return advanceStreetOrTurn(
    {
      ...state,
      players,
      pot,
      currentMaxBet,
      minRaise,
    },
    logs,
  );
}

export function chooseHoldemBotAction(state: HoldemState): HoldemAction | null {
  if (state.street === 'showdown') return null;
  const bot = state.players[state.currentPlayerIndex];
  if (!bot || !bot.isBot || bot.folded || bot.allIn) return null;

  const toCall = Math.max(0, state.currentMaxBet - bot.currentBet);
  const r = Math.random();

  if (toCall === 0) {
    if (r < 0.25 && bot.chips >= state.bigBlind * 2) {
      return {
        type: 'HOLDEM_RAISE',
        playerId: bot.id,
        amount: state.currentMaxBet + state.bigBlind,
      };
    }
    return { type: 'HOLDEM_CHECK_CALL', playerId: bot.id };
  }

  if (toCall > bot.chips * 0.6 && r < 0.45) {
    return { type: 'HOLDEM_FOLD', playerId: bot.id };
  }
  return { type: 'HOLDEM_CHECK_CALL', playerId: bot.id };
}

export function sanitizeHoldemStateForPlayer(
  state: HoldemState,
  viewerId: string,
): HoldemState {
  if (state.street === 'showdown') return state;
  return {
    ...state,
    deck: state.deck.map((_, i) => ({ id: `hidden_deck_${i}`, suit: 'spades', rank: '2' })),
    players: state.players.map((p) =>
      p.id === viewerId
        ? p
        : {
            ...p,
            hand: p.hand.map((_, i) => ({
              id: `hidden_${p.id}_${i}`,
              suit: 'spades',
              rank: '2',
            })),
          },
    ),
  };
}
