import type {
  Card,
  DebertsAction,
  DebertsPlayer,
  DebertsState,
  DebertsTrickCard,
  GameLogEntry,
  Rank,
  RoomPlayerInfo,
  Suit,
} from './types';
import { createDeck, formatCard, shuffleDeck, SUIT_NAMES_UK } from './gameEngine';

const DEBERTS_RANKS: Rank[] = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const TARGET_SCORE = 301;

const TRUMP_POINTS: Partial<Record<Rank, number>> = {
  J: 20,
  '9': 14,
  A: 11,
  '10': 10,
  K: 4,
  Q: 3,
  '8': 0,
  '7': 0,
};

const PLAIN_POINTS: Partial<Record<Rank, number>> = {
  A: 11,
  '10': 10,
  K: 4,
  Q: 3,
  J: 2,
  '9': 0,
  '8': 0,
  '7': 0,
};

const TRUMP_POWER: Partial<Record<Rank, number>> = {
  J: 8,
  '9': 7,
  A: 6,
  '10': 5,
  K: 4,
  Q: 3,
  '8': 2,
  '7': 1,
};

const PLAIN_POWER: Partial<Record<Rank, number>> = {
  A: 8,
  '10': 7,
  K: 6,
  Q: 5,
  J: 4,
  '9': 3,
  '8': 2,
  '7': 1,
};

function makeLog(text: string, type: GameLogEntry['type'] = 'info'): GameLogEntry {
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    text,
    type,
    timestamp: Date.now(),
  };
}

export function getDebertsCardPoints(card: Card, trumpSuit: Suit): number {
  return card.suit === trumpSuit
    ? TRUMP_POINTS[card.rank] ?? 0
    : PLAIN_POINTS[card.rank] ?? 0;
}

export function getDebertsCardPower(card: Card, trumpSuit: Suit): number {
  return card.suit === trumpSuit
    ? TRUMP_POWER[card.rank] ?? 0
    : PLAIN_POWER[card.rank] ?? 0;
}

function dealDebertsRound(
  players: DebertsPlayer[],
  round: number,
  dealerIndex: number,
  rng: () => number = Math.random,
): DebertsState {
  const capped = players.slice(0, 4);
  const deck = shuffleDeck(createDeck(DEBERTS_RANKS), rng);
  const dealtPlayers: DebertsPlayer[] = capped.map((p) => {
    const hand: Card[] = [];
    for (let i = 0; i < 6; i++) {
      const c = deck.pop();
      if (c) hand.push(c);
    }
    return { ...p, hand, roundPoints: 0 };
  });

  const proposedTrumpCard = deck.pop() ?? null;
  const firstPlayer = (dealerIndex + 1) % dealtPlayers.length;

  return {
    round,
    players: dealtPlayers,
    dealerIndex,
    currentPlayerIndex: firstPlayer,
    proposedTrumpCard,
    trumpSuit: proposedTrumpCard?.suit ?? 'spades',
    callerId: null,
    bidRound: 1,
    trick: [],
    phase: 'bidding',
    bellaDeclaredBy: null,
    winnerId: null,
    logs: [
      makeLog(
        `Раунд ${round}: торги за козир (${proposedTrumpCard ? formatCard(proposedTrumpCard) : '♠'}).`,
        'info',
      ),
    ],
  };
}

export function createDebertsMatch(
  roomPlayers: RoomPlayerInfo[],
  rng: () => number = Math.random,
): DebertsState {
  const players: DebertsPlayer[] = roomPlayers.slice(0, 4).map((p) => ({
    id: p.id,
    name: p.name,
    hand: [],
    roundPoints: 0,
    totalScore: 0,
    connected: p.connected,
    isHost: p.isHost,
    isBot: p.isBot,
  }));
  return dealDebertsRound(players, 1, 0, rng);
}

export function sanitizeDebertsStateForPlayer(state: DebertsState, viewerId: string): DebertsState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === viewerId
        ? p
        : {
            ...p,
            hand: p.hand.map((_, idx) => ({ id: `hidden_${p.id}_${idx}`, suit: 'spades', rank: '7' })),
          },
    ),
  };
}

export function isDebertsCardPlayable(card: Card, hand: Card[], state: DebertsState): boolean {
  if (state.phase !== 'playing') return false;
  if (state.trick.length === 0) return true;

  const leadSuit = state.trick[0].card.suit;
  const hasLeadSuit = hand.some((c) => c.suit === leadSuit);

  if (hasLeadSuit) {
    if (card.suit !== leadSuit) return false;
    if (leadSuit === state.trumpSuit) {
      const highestTrumpOnTable = Math.max(
        0,
        ...state.trick
          .filter((t) => t.card.suit === state.trumpSuit)
          .map((t) => getDebertsCardPower(t.card, state.trumpSuit)),
      );
      const canBeat = hand.some(
        (c) => c.suit === state.trumpSuit && getDebertsCardPower(c, state.trumpSuit) > highestTrumpOnTable,
      );
      if (canBeat) {
        return getDebertsCardPower(card, state.trumpSuit) > highestTrumpOnTable;
      }
    }
    return true;
  }

  const hasTrump = hand.some((c) => c.suit === state.trumpSuit);
  if (hasTrump) {
    if (card.suit !== state.trumpSuit) return false;
    const highestTrumpOnTable = Math.max(
      0,
      ...state.trick
        .filter((t) => t.card.suit === state.trumpSuit)
        .map((t) => getDebertsCardPower(t.card, state.trumpSuit)),
    );
    const canBeat = hand.some(
      (c) => c.suit === state.trumpSuit && getDebertsCardPower(c, state.trumpSuit) > highestTrumpOnTable,
    );
    if (canBeat) {
      return getDebertsCardPower(card, state.trumpSuit) > highestTrumpOnTable;
    }
    return true;
  }

  return true;
}

function resolveTrickWinner(trick: DebertsTrickCard[], trumpSuit: Suit): string {
  const leadSuit = trick[0].card.suit;
  const trumpPlays = trick.filter((t) => t.card.suit === trumpSuit);
  const candidates = trumpPlays.length > 0 ? trumpPlays : trick.filter((t) => t.card.suit === leadSuit);
  let best = candidates[0];
  for (const t of candidates.slice(1)) {
    if (getDebertsCardPower(t.card, trumpSuit) > getDebertsCardPower(best.card, trumpSuit)) {
      best = t;
    }
  }
  return best.playerId;
}

function finishBiddingAndDealExtra(
  state: DebertsState,
  trumpSuit: Suit,
  callerId: string,
  rng: () => number,
): DebertsState {
  const usedIds = new Set<string>();
  for (const p of state.players) {
    for (const c of p.hand) usedIds.add(c.id);
  }
  const remainingDeck = shuffleDeck(
    createDeck(DEBERTS_RANKS).filter((c) => !usedIds.has(c.id)),
    rng,
  );

  // Deal 2 more cards each (up to 8 each for 4 players = 32 cards, or 3 each up to 9 for 2-3 players)
  const extraPerPlayer = state.players.length <= 3 ? 3 : 2;
  const players = state.players.map((p) => {
    const extra: Card[] = [];
    for (let i = 0; i < extraPerPlayer; i++) {
      const c = remainingDeck.pop();
      if (c) extra.push(c);
    }
    return { ...p, hand: [...p.hand, ...extra] };
  });

  const caller = players.find((p) => p.id === callerId);
  const firstIdx = (state.dealerIndex + 1) % players.length;

  return {
    ...state,
    players,
    trumpSuit,
    callerId,
    proposedTrumpCard: null,
    phase: 'playing',
    currentPlayerIndex: firstIdx,
    logs: [
      ...state.logs,
      makeLog(
        `${caller?.name ?? 'Гравець'} замовив козир ${SUIT_NAMES_UK[trumpSuit]}!`,
        'special',
      ),
    ].slice(-20),
  };
}

export function applyDebertsAction(
  state: DebertsState,
  action: DebertsAction,
  rng: () => number = Math.random,
): DebertsState {
  if (action.type === 'DEBERTS_REMATCH') {
    if (state.phase !== 'match_over') return state;
    return dealDebertsRound(
      state.players.map((p) => ({ ...p, totalScore: 0, roundPoints: 0, hand: [] })),
      1,
      0,
      rng,
    );
  }

  if (action.type === 'DEBERTS_NEXT_ROUND') {
    if (state.phase !== 'round_over') return state;
    const nextDealer = (state.dealerIndex + 1) % state.players.length;
    return dealDebertsRound(state.players, state.round + 1, nextDealer, rng);
  }

  const active = state.players[state.currentPlayerIndex];
  if (!active || active.id !== action.playerId) return state;

  if (action.type === 'DEBERTS_ACCEPT_TRUMP') {
    if (state.phase !== 'bidding' || state.bidRound !== 1) return state;
    return finishBiddingAndDealExtra(state, state.trumpSuit, active.id, rng);
  }

  if (action.type === 'DEBERTS_CHOOSE_TRUMP') {
    if (state.phase !== 'bidding' || state.bidRound !== 2) return state;
    if (state.proposedTrumpCard && action.suit === state.proposedTrumpCard.suit) return state;
    return finishBiddingAndDealExtra(state, action.suit, active.id, rng);
  }

  if (action.type === 'DEBERTS_PASS_BID') {
    if (state.phase !== 'bidding') return state;
    const nextIdx = (state.currentPlayerIndex + 1) % state.players.length;
    const firstBidder = (state.dealerIndex + 1) % state.players.length;
    if (nextIdx === firstBidder) {
      if (state.bidRound === 1) {
        return {
          ...state,
          bidRound: 2,
          currentPlayerIndex: firstBidder,
          logs: [...state.logs, makeLog('Усі пас у 1-му колі — замовте іншу масть!')].slice(-20),
        };
      }
      // Everyone passed twice -> redeal
      const nextDealer = (state.dealerIndex + 1) % state.players.length;
      return dealDebertsRound(state.players, state.round, nextDealer, rng);
    }
    return {
      ...state,
      currentPlayerIndex: nextIdx,
      logs: [...state.logs, makeLog(`${active.name} пас.`)].slice(-20),
    };
  }

  if (action.type === 'DEBERTS_PLAY_CARD') {
    if (state.phase !== 'playing') return state;
    const card = active.hand.find((c) => c.id === action.cardId);
    if (!card || !isDebertsCardPlayable(card, active.hand, state)) return state;

    let bellaBonus = 0;
    let bellaDeclaredBy = state.bellaDeclaredBy;
    const logs = [...state.logs];

    // Check Bella (Q + K of trump suit in hand when playing either)
    if (
      !bellaDeclaredBy &&
      card.suit === state.trumpSuit &&
      (card.rank === 'Q' || card.rank === 'K')
    ) {
      const pairRank: Rank = card.rank === 'Q' ? 'K' : 'Q';
      if (active.hand.some((c) => c.suit === state.trumpSuit && c.rank === pairRank)) {
        bellaBonus = 20;
        bellaDeclaredBy = active.id;
        logs.push(makeLog(`👑 Белла! ${active.name} отримує +20 очок!`, 'special'));
      }
    }

    const updatedPlayers = state.players.map((p, idx) =>
      idx === state.currentPlayerIndex
        ? {
            ...p,
            hand: p.hand.filter((c) => c.id !== card.id),
            roundPoints: p.roundPoints + bellaBonus,
          }
        : p,
    );

    const nextTrick = [...state.trick, { playerId: active.id, card }];
    logs.push(makeLog(`${active.name} поклав ${formatCard(card)}`));

    if (nextTrick.length < updatedPlayers.length) {
      return {
        ...state,
        players: updatedPlayers,
        trick: nextTrick,
        bellaDeclaredBy,
        currentPlayerIndex: (state.currentPlayerIndex + 1) % updatedPlayers.length,
        logs: logs.slice(-20),
      };
    }

    // Resolve trick
    const winnerId = resolveTrickWinner(nextTrick, state.trumpSuit);
    const winnerIdx = updatedPlayers.findIndex((p) => p.id === winnerId);
    const trickPoints = nextTrick.reduce(
      (sum, t) => sum + getDebertsCardPoints(t.card, state.trumpSuit),
      0,
    );
    const isLastTrick = updatedPlayers.every((p) => p.hand.length === 0);
    const totalTrickPoints = trickPoints + (isLastTrick ? 10 : 0);

    const afterTrickPlayers = updatedPlayers.map((p, idx) =>
      idx === winnerIdx ? { ...p, roundPoints: p.roundPoints + totalTrickPoints } : p,
    );
    logs.push(
      makeLog(
        `Взятку взяв ${afterTrickPlayers[winnerIdx].name} (+${totalTrickPoints}${isLastTrick ? ', +10 остання' : ''}).`,
        'info',
      ),
    );

    if (!isLastTrick) {
      return {
        ...state,
        players: afterTrickPlayers,
        trick: [],
        bellaDeclaredBy,
        currentPlayerIndex: winnerIdx,
        logs: logs.slice(-20),
      };
    }

    // End of round: check Byte (caller must have strictly more or equal to highest opponent? In Deberts, if caller < best opponent -> byte!)
    const caller = afterTrickPlayers.find((p) => p.id === state.callerId);
    const maxOppPoints = Math.max(
      0,
      ...afterTrickPlayers.filter((p) => p.id !== state.callerId).map((p) => p.roundPoints),
    );
    const isByte = Boolean(caller && caller.roundPoints < maxOppPoints);

    const finalizedPlayers = afterTrickPlayers.map((p) => {
      if (isByte && p.id === state.callerId) {
        return p; // 0 added on byte
      }
      if (isByte && caller && p.roundPoints === maxOppPoints) {
        return { ...p, totalScore: p.totalScore + p.roundPoints + caller.roundPoints };
      }
      return { ...p, totalScore: p.totalScore + p.roundPoints };
    });

    if (isByte && caller) {
      logs.push(makeLog(`💥 БАЙТ! ${caller.name} не набрав очок — очки переходять супернику!`, 'warning'));
    }

    const matchWinner = finalizedPlayers.find((p) => p.totalScore >= TARGET_SCORE);
    if (matchWinner) {
      logs.push(makeLog(`🏆 ${matchWinner.name} виграв матч Деберца (${matchWinner.totalScore})!`, 'special'));
    }

    return {
      ...state,
      players: finalizedPlayers,
      trick: [],
      bellaDeclaredBy,
      phase: matchWinner ? 'match_over' : 'round_over',
      winnerId: matchWinner?.id ?? afterTrickPlayers[winnerIdx].id,
      logs: logs.slice(-20),
    };
  }

  return state;
}

export function chooseDebertsBotAction(state: DebertsState): DebertsAction | null {
  const bot = state.players[state.currentPlayerIndex];
  if (!bot || !bot.isBot) return null;

  if (state.phase === 'bidding') {
    if (state.bidRound === 1) {
      const hasStrongTrump = bot.hand.some(
        (c) => c.suit === state.trumpSuit && (c.rank === 'J' || c.rank === '9'),
      );
      return hasStrongTrump
        ? { type: 'DEBERTS_ACCEPT_TRUMP', playerId: bot.id }
        : { type: 'DEBERTS_PASS_BID', playerId: bot.id };
    }
    const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
    const altSuits = suits.filter((s) => s !== state.proposedTrumpCard?.suit);
    for (const s of altSuits) {
      if (bot.hand.some((c) => c.suit === s && c.rank === 'J')) {
        return { type: 'DEBERTS_CHOOSE_TRUMP', playerId: bot.id, suit: s };
      }
    }
    return { type: 'DEBERTS_PASS_BID', playerId: bot.id };
  }

  if (state.phase === 'playing') {
    const playable = bot.hand.filter((c) => isDebertsCardPlayable(c, bot.hand, state));
    if (playable.length === 0) return null;
    const sorted = [...playable].sort(
      (a, b) => getDebertsCardPoints(b, state.trumpSuit) - getDebertsCardPoints(a, state.trumpSuit),
    );
    return { type: 'DEBERTS_PLAY_CARD', playerId: bot.id, cardId: sorted[0].id };
  }

  return null;
}
