import type {
  Card,
  GameAction,
  GameLogEntry,
  GameState,
  Player,
  Rank,
  RoundScoreEntry,
  Suit,
} from './types';

export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
export const RANKS: Rank[] = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

export const SUIT_NAMES_UK: Record<Suit, string> = {
  spades: 'Піка ♠',
  hearts: 'Чирва ♥',
  diamonds: 'Бубна ♦',
  clubs: 'Хреста ♣',
};

const MAX_LOGS = 20;

export function formatCard(card: Card): string {
  return `${card.rank}${SUIT_SYMBOLS[card.suit]}`;
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `${rank}_${suit}`, suit, rank });
    }
  }
  return deck;
}

export function shuffleDeck(cards: Card[], rng: () => number = Math.random): Card[] {
  const arr = [...cards];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function makeLog(
  text: string,
  type: GameLogEntry['type'] = 'info',
): GameLogEntry {
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

export function getCardPoints(card: Card): number {
  switch (card.rank) {
    case '6':
    case '7':
    case '8':
    case '9':
      return 0;
    case '10':
      return 10;
    case 'Q':
      return 3;
    case 'K':
      return card.suit === 'spades' ? 40 : 4;
    case 'A':
      return 11;
    case 'J':
      return 20;
  }
}

export function calculateHandPoints(hand: Card[]): number {
  return hand.reduce((sum, card) => sum + getCardPoints(card), 0);
}

/**
 * Draws `count` cards from `deck`. If `deck` runs out and `discardPile` has
 * more than 1 card, reshuffles `discardPile` (except its top card) into `deck`.
 */
export function drawFromDeck(
  deck: Card[],
  discardPile: Card[],
  count: number,
  rng: () => number = Math.random,
): { drawn: Card[]; deck: Card[]; discardPile: Card[]; reshuffled: boolean } {
  let currentDeck = [...deck];
  let currentDiscard = [...discardPile];
  const drawn: Card[] = [];
  let reshuffled = false;

  for (let i = 0; i < count; i++) {
    if (currentDeck.length === 0) {
      if (currentDiscard.length <= 1) {
        break;
      }
      const topCard = currentDiscard[currentDiscard.length - 1];
      const toShuffle = currentDiscard.slice(0, -1);
      currentDeck = shuffleDeck(toShuffle, rng);
      currentDiscard = [topCard];
      reshuffled = true;
    }
    const nextCard = currentDeck.pop();
    if (nextCard) {
      drawn.push(nextCard);
    }
  }

  return { drawn, deck: currentDeck, discardPile: currentDiscard, reshuffled };
}

export function checkBridgeOnTop(discardPile: Card[]): boolean {
  if (discardPile.length < 4) return false;
  const lastFour = discardPile.slice(-4);
  const rank = lastFour[0].rank;
  return lastFour.every((c) => c.rank === rank);
}

/**
 * Checks whether a single card can be placed as the FIRST card of a play
 * given the current table state.
 */
export function isCardPlayable(card: Card, state: GameState): boolean {
  if (state.phase !== 'playing' && state.phase !== 'must_cover_six') {
    return false;
  }

  const topCard = state.discardPile[state.discardPile.length - 1];
  if (!topCard) return false;

  if (state.phase === 'must_cover_six') {
    // Jack cannot be placed on an uncovered 6
    if (card.rank === 'J') return false;
    return card.rank === '6' || card.suit === state.activeSuit;
  }

  // Normal 'playing' phase
  if (card.rank === 'J') {
    return true;
  }

  if (state.orderedSuit !== null) {
    return card.suit === state.orderedSuit;
  }

  return card.suit === state.activeSuit || card.rank === topCard.rank;
}

export function canPlayerMakeAnyPlay(player: Player, state: GameState): boolean {
  return player.hand.some((card) => {
    if (!isCardPlayable(card, state)) return false;
    // Cannot play 6 as the last card in hand
    if (card.rank === '6' && player.hand.length === 1) return false;
    return true;
  });
}

export function validateSeriesPlay(
  cardIds: string[],
  hand: Card[],
  state: GameState,
): { valid: true; cards: Card[] } | { valid: false; reason: string } {
  if (cardIds.length === 0 || cardIds.length > 4) {
    return { valid: false, reason: 'Можна викласти від 1 до 4 карт.' };
  }

  const uniqueIds = new Set(cardIds);
  if (uniqueIds.size !== cardIds.length) {
    return { valid: false, reason: 'Дублікат карти в серії.' };
  }

  const cards: Card[] = [];
  for (const id of cardIds) {
    const found = hand.find((c) => c.id === id);
    if (!found) {
      return { valid: false, reason: 'Карта не знайдена в руці.' };
    }
    cards.push(found);
  }

  const seriesRank = cards[0].rank;
  if (!cards.every((c) => c.rank === seriesRank)) {
    return { valid: false, reason: 'Усі карти в серії мають бути одного номіналу.' };
  }

  if (!isCardPlayable(cards[0], state)) {
    return { valid: false, reason: 'Перша карта серії не підходить до карти на столі.' };
  }

  // Forbidden to play 6 as last card(s) in hand
  if (seriesRank === '6' && cards.length === hand.length) {
    return { valid: false, reason: 'Заборонено скидати 6 останньою картою в руці.' };
  }

  return { valid: true, cards };
}

function finalizeRound(
  state: GameState,
  winnerId: string,
  winReason: 'empty_hand' | 'bridge',
  lastPlayedCards: Card[],
  extraLogs: GameLogEntry[],
): GameState {
  const winner = state.players.find((p) => p.id === winnerId)!;
  const deltas: Record<string, number> = {};
  const totals: Record<string, number> = {};
  const resetToZeroPlayerIds: string[] = [];

  const endedWithJack =
    winReason === 'empty_hand' &&
    lastPlayedCards.length > 0 &&
    lastPlayedCards[lastPlayedCards.length - 1].rank === 'J';

  const updatedPlayers = state.players.map((p) => {
    let delta = 0;
    if (p.id === winnerId) {
      if (endedWithJack) {
        delta = -20 * lastPlayedCards.length;
      }
    } else {
      delta = calculateHandPoints(p.hand);
    }

    let newScore = p.score + delta;
    if (newScore === 125) {
      newScore = 0;
      resetToZeroPlayerIds.push(p.id);
    }

    deltas[p.id] = delta;
    totals[p.id] = newScore;

    return {
      ...p,
      score: newScore,
    };
  });

  const anyLoser = updatedPlayers.some((p) => p.score >= 126);

  const entry: RoundScoreEntry = {
    round: state.round,
    winnerId,
    winnerName: winner.name,
    winReason,
    deltas,
    totals,
    resetToZeroPlayerIds,
  };

  const logs = [...extraLogs];
  if (winReason === 'bridge') {
    logs.push(makeLog(`БРИДЖ! ${winner.name} зібрав 4 карти одного номіналу!`, 'bridge'));
  } else {
    logs.push(makeLog(`${winner.name} виграв раунд ${state.round}!`, 'special'));
  }
  if (endedWithJack) {
    logs.push(
      makeLog(
        `Закінчення Валетом: ${winner.name} отримує ${-20 * lastPlayedCards.length} очок!`,
        'special',
      ),
    );
  }
  for (const resetId of resetToZeroPlayerIds) {
    const rp = updatedPlayers.find((p) => p.id === resetId);
    if (rp) {
      logs.push(makeLog(`${rp.name} набрав рівно 125 — рахунок обнулено до 0!`, 'special'));
    }
  }
  if (anyLoser) {
    logs.push(makeLog('Гру завершено! Хтось набрав 126+ очок.', 'warning'));
  }

  return {
    ...state,
    players: updatedPlayers,
    phase: anyLoser ? 'match_over' : 'round_over',
    roundWinnerId: winnerId,
    roundWinReason: winReason,
    hasDrawnThisTurn: false,
    drawnCardId: null,
    scoreHistory: [...state.scoreHistory, entry],
    logs: appendLogs(state.logs, ...logs),
  };
}

function applyOpeningCardEffect(
  state: GameState,
  openingCard: Card,
  firstPlayerIndex: number,
  rng: () => number,
): GameState {
  const numPlayers = state.players.length;
  const firstPlayer = state.players[firstPlayerIndex];
  const logs: GameLogEntry[] = [
    makeLog(`Раунд ${state.round}. Стартова карта: ${formatCard(openingCard)}`),
  ];

  let deck = state.deck;
  let discardPile = state.discardPile;
  const players = state.players.map((p) => ({ ...p, hand: [...p.hand] }));

  if (openingCard.rank === '6') {
    logs.push(
      makeLog(
        `Стартова 6${SUIT_SYMBOLS[openingCard.suit]}! ${firstPlayer.name} має її покрити.`,
        'special',
      ),
    );
    return {
      ...state,
      phase: 'must_cover_six',
      currentPlayerIndex: firstPlayerIndex,
      logs: appendLogs(state.logs, ...logs),
    };
  }

  if (openingCard.rank === '7') {
    const res = drawFromDeck(deck, discardPile, 2, rng);
    deck = res.deck;
    discardPile = res.discardPile;
    players[firstPlayerIndex].hand.push(...res.drawn);
    const nextIdx = (firstPlayerIndex + 1) % numPlayers;
    logs.push(
      makeLog(
        `Стартова 7: ${firstPlayer.name} бере ${res.drawn.length} карти і пропускає хід.`,
        'special',
      ),
    );
    return {
      ...state,
      players,
      deck,
      discardPile,
      currentPlayerIndex: nextIdx,
      logs: appendLogs(state.logs, ...logs),
    };
  }

  if (openingCard.rank === '8') {
    const res = drawFromDeck(deck, discardPile, 1, rng);
    deck = res.deck;
    discardPile = res.discardPile;
    players[firstPlayerIndex].hand.push(...res.drawn);
    logs.push(
      makeLog(
        `Стартова 8: ${firstPlayer.name} бере 1 карту і ходить.`,
        'special',
      ),
    );
    return {
      ...state,
      players,
      deck,
      discardPile,
      currentPlayerIndex: firstPlayerIndex,
      logs: appendLogs(state.logs, ...logs),
    };
  }

  if (openingCard.rank === 'K' && openingCard.suit === 'spades') {
    const res = drawFromDeck(deck, discardPile, 4, rng);
    deck = res.deck;
    discardPile = res.discardPile;
    players[firstPlayerIndex].hand.push(...res.drawn);
    const nextIdx = (firstPlayerIndex + 1) % numPlayers;
    logs.push(
      makeLog(
        `Стартовий K♠! ${firstPlayer.name} бере ${res.drawn.length} карти і пропускає хід.`,
        'special',
      ),
    );
    return {
      ...state,
      players,
      deck,
      discardPile,
      currentPlayerIndex: nextIdx,
      logs: appendLogs(state.logs, ...logs),
    };
  }

  if (openingCard.rank === 'A') {
    const nextIdx = (firstPlayerIndex + 1) % numPlayers;
    logs.push(
      makeLog(`Стартовий Туз: ${firstPlayer.name} пропускає хід.`, 'special'),
    );
    return {
      ...state,
      currentPlayerIndex: nextIdx,
      logs: appendLogs(state.logs, ...logs),
    };
  }

  if (openingCard.rank === 'J') {
    logs.push(
      makeLog(
        `Стартовий Валет ${formatCard(openingCard)} — активна масть ${SUIT_NAMES_UK[openingCard.suit]}.`,
        'special',
      ),
    );
  }

  return {
    ...state,
    currentPlayerIndex: firstPlayerIndex,
    logs: appendLogs(state.logs, ...logs),
  };
}

export function createMatch(
  playerInfos: Array<{
    id: string;
    name: string;
    isHost?: boolean;
    isBot?: boolean;
    avatarUrl?: string;
  }>,
  rng: () => number = Math.random,
): GameState {
  const players: Player[] = playerInfos.map((info) => ({
    id: info.id,
    name: info.name,
    hand: [],
    score: 0,
    connected: true,
    isHost: info.isHost,
    isBot: info.isBot,
    avatarUrl: info.avatarUrl,
  }));

  return dealRound(
    {
      round: 0,
      players,
      dealerIndex: 0,
      currentPlayerIndex: 0,
      deck: [],
      discardPile: [],
      activeSuit: 'spades',
      orderedSuit: null,
      phase: 'playing',
      hasDrawnThisTurn: false,
      drawnCardId: null,
      lastPlayedIds: [],
      roundWinnerId: null,
      roundWinReason: null,
      scoreHistory: [],
      logs: [],
    },
    0,
    rng,
  );
}

export function dealRound(
  prevState: GameState,
  dealerIndex: number,
  rng: () => number = Math.random,
): GameState {
  const deck = shuffleDeck(createDeck(), rng);
  const numPlayers = prevState.players.length;
  const players: Player[] = prevState.players.map((p) => ({ ...p, hand: [] }));

  // Non-dealers get 5 cards; dealer gets 4 cards + 5th card goes face-up
  for (let i = 0; i < numPlayers; i++) {
    const count = i === dealerIndex ? 4 : 5;
    for (let c = 0; c < count; c++) {
      const card = deck.pop();
      if (card) players[i].hand.push(card);
    }
  }

  const openingCard = deck.pop()!;
  const firstPlayerIndex = (dealerIndex + 1) % numPlayers;

  const baseState: GameState = {
    ...prevState,
    round: prevState.round + 1,
    players,
    dealerIndex,
    currentPlayerIndex: firstPlayerIndex,
    deck,
    discardPile: [openingCard],
    activeSuit: openingCard.suit,
    orderedSuit: null,
    phase: 'playing',
    hasDrawnThisTurn: false,
    drawnCardId: null,
    lastPlayedIds: [openingCard.id],
    roundWinnerId: null,
    roundWinReason: null,
  };

  return applyOpeningCardEffect(baseState, openingCard, firstPlayerIndex, rng);
}

function resolveSpecialEffects(
  updatedState: GameState,
  playedCards: Card[],
  logs: GameLogEntry[],
  rng: () => number,
): GameState {
  const activePlayer = updatedState.players[updatedState.currentPlayerIndex];
  const lastCard = playedCards[playedCards.length - 1];
  const players = updatedState.players.map((p) => ({ ...p, hand: [...p.hand] }));
  let deck = [...updatedState.deck];
  let discardPile = [...updatedState.discardPile];
  const numPlayers = players.length;

  // Check empty hand win
  if (players[updatedState.currentPlayerIndex].hand.length === 0) {
    return finalizeRound(updatedState, activePlayer.id, 'empty_hand', playedCards, logs);
  }

  // Apply special effect of the last played card
  if (lastCard.rank === '6') {
    logs.push(
      makeLog(`${activePlayer.name} має покрити ${formatCard(lastCard)}!`, 'special'),
    );
    return {
      ...updatedState,
      phase: 'must_cover_six',
      currentPlayerIndex: updatedState.currentPlayerIndex,
      logs: appendLogs(updatedState.logs, ...logs),
    };
  }

  if (lastCard.rank === 'J') {
    return {
      ...updatedState,
      phase: 'choosing_suit',
      currentPlayerIndex: updatedState.currentPlayerIndex,
      logs: appendLogs(updatedState.logs, ...logs),
    };
  }

  if (lastCard.rank === '7') {
    const victimIdx = (updatedState.currentPlayerIndex + 1) % numPlayers;
    const res = drawFromDeck(deck, discardPile, 2, rng);
    deck = res.deck;
    discardPile = res.discardPile;
    players[victimIdx].hand.push(...res.drawn);
    const nextIdx = (updatedState.currentPlayerIndex + 2) % numPlayers;
    logs.push(
      makeLog(
        `${players[victimIdx].name} бере ${res.drawn.length} карти і пропускає хід.`,
        'special',
      ),
    );
    return {
      ...updatedState,
      players,
      deck,
      discardPile,
      phase: 'playing',
      currentPlayerIndex: nextIdx,
      logs: appendLogs(updatedState.logs, ...logs),
    };
  }

  if (lastCard.rank === '8') {
    const nextIdx = (updatedState.currentPlayerIndex + 1) % numPlayers;
    const res = drawFromDeck(deck, discardPile, 1, rng);
    deck = res.deck;
    discardPile = res.discardPile;
    players[nextIdx].hand.push(...res.drawn);
    logs.push(makeLog(`${players[nextIdx].name} бере 1 карту і ходить.`, 'special'));
    return {
      ...updatedState,
      players,
      deck,
      discardPile,
      phase: 'playing',
      currentPlayerIndex: nextIdx,
      logs: appendLogs(updatedState.logs, ...logs),
    };
  }

  if (lastCard.rank === 'K' && lastCard.suit === 'spades') {
    const victimIdx = (updatedState.currentPlayerIndex + 1) % numPlayers;
    const res = drawFromDeck(deck, discardPile, 4, rng);
    deck = res.deck;
    discardPile = res.discardPile;
    players[victimIdx].hand.push(...res.drawn);
    const nextIdx = (updatedState.currentPlayerIndex + 2) % numPlayers;
    logs.push(
      makeLog(
        `Король пік! ${players[victimIdx].name} бере ${res.drawn.length} карти і пропускає хід.`,
        'special',
      ),
    );
    return {
      ...updatedState,
      players,
      deck,
      discardPile,
      phase: 'playing',
      currentPlayerIndex: nextIdx,
      logs: appendLogs(updatedState.logs, ...logs),
    };
  }

  if (lastCard.rank === 'A') {
    const skips = playedCards.length;
    const nextIdx = (updatedState.currentPlayerIndex + 1 + skips) % numPlayers;
    const skippedNames: string[] = [];
    for (let s = 1; s <= skips; s++) {
      skippedNames.push(players[(updatedState.currentPlayerIndex + s) % numPlayers].name);
    }
    logs.push(makeLog(`Туз! Пропускають: ${skippedNames.join(', ')}.`, 'special'));
    return {
      ...updatedState,
      phase: 'playing',
      currentPlayerIndex: nextIdx,
      logs: appendLogs(updatedState.logs, ...logs),
    };
  }

  const nextIdx = (updatedState.currentPlayerIndex + 1) % numPlayers;
  return {
    ...updatedState,
    phase: 'playing',
    currentPlayerIndex: nextIdx,
    logs: appendLogs(updatedState.logs, ...logs),
  };
}

export function applyAction(
  state: GameState,
  action: GameAction,
  rng: () => number = Math.random,
): GameState {
  if (action.type === 'START_NEXT_ROUND') {
    if (state.phase !== 'round_over') return state;
    const winnerIdx = state.players.findIndex((p) => p.id === state.roundWinnerId);
    const nextDealer = winnerIdx >= 0 ? winnerIdx : (state.dealerIndex + 1) % state.players.length;
    return dealRound(state, nextDealer, rng);
  }

  const activePlayer = state.players[state.currentPlayerIndex];
  if (!activePlayer || activePlayer.id !== action.playerId) {
    return state;
  }

  switch (action.type) {
    case 'PLAY_CARDS': {
      if (state.phase !== 'playing' && state.phase !== 'must_cover_six') {
        return state;
      }

      const validation = validateSeriesPlay(action.cardIds, activePlayer.hand, state);
      if (!validation.valid) {
        return state;
      }

      const playedCards = validation.cards;
      const lastCard = playedCards[playedCards.length - 1];
      const playedSet = new Set(action.cardIds);

      const players = state.players.map((p, idx) =>
        idx === state.currentPlayerIndex
          ? { ...p, hand: p.hand.filter((c) => !playedSet.has(c.id)) }
          : { ...p, hand: [...p.hand] },
      );

      const deck = [...state.deck];
      const discardPile = [...state.discardPile, ...playedCards];

      const playedText = playedCards.map(formatCard).join(' ');
      const logs: GameLogEntry[] = [
        makeLog(`${activePlayer.name} поклав ${playedText}`),
      ];

      const updatedState: GameState = {
        ...state,
        players,
        deck,
        discardPile,
        activeSuit: lastCard.suit,
        orderedSuit: null,
        hasDrawnThisTurn: false,
        drawnCardId: null,
        lastPlayedIds: playedCards.map((c) => c.id),
        lastPlayedCount: playedCards.length,
      };

      // Check «Бридж!» (4 same-rank cards on top of discard pile)
      if (checkBridgeOnTop(discardPile)) {
        // If hand is already empty, end round immediately
        if (players[state.currentPlayerIndex].hand.length === 0) {
          return finalizeRound(updatedState, activePlayer.id, 'bridge', playedCards, logs);
        }
        logs.push(
          makeLog(`${activePlayer.name} може оголосити БРИДЖ!`, 'bridge'),
        );
        return {
          ...updatedState,
          phase: 'bridge_choice',
          currentPlayerIndex: state.currentPlayerIndex,
          logs: appendLogs(state.logs, ...logs),
        };
      }

      return resolveSpecialEffects(updatedState, playedCards, logs, rng);
    }

    case 'DECLARE_BRIDGE': {
      if (state.phase !== 'bridge_choice') return state;
      const count = state.lastPlayedCount ?? 1;
      const playedCards = state.discardPile.slice(-count);
      return finalizeRound(state, activePlayer.id, 'bridge', playedCards, []);
    }

    case 'DECLINE_BRIDGE': {
      if (state.phase !== 'bridge_choice') return state;
      const count = state.lastPlayedCount ?? 1;
      const playedCards = state.discardPile.slice(-count);
      const log = makeLog(`${activePlayer.name} продовжує гру без Бриджу.`);
      return resolveSpecialEffects(state, playedCards, [log], rng);
    }

    case 'CHOOSE_SUIT': {
      if (state.phase !== 'choosing_suit') return state;
      const nextIdx = (state.currentPlayerIndex + 1) % state.players.length;
      const log = makeLog(`Замовлено масть: ${SUIT_NAMES_UK[action.suit]}`, 'special');
      return {
        ...state,
        activeSuit: action.suit,
        orderedSuit: action.suit,
        phase: 'playing',
        currentPlayerIndex: nextIdx,
        logs: appendLogs(state.logs, log),
      };
    }

    case 'DRAW_CARD': {
      if (state.phase !== 'playing' && state.phase !== 'must_cover_six') {
        return state;
      }
      if (state.phase === 'playing' && state.hasDrawnThisTurn) {
        return state;
      }

      const res = drawFromDeck(state.deck, state.discardPile, 1, rng);
      const players = state.players.map((p, idx) =>
        idx === state.currentPlayerIndex
          ? { ...p, hand: [...p.hand, ...res.drawn] }
          : { ...p, hand: [...p.hand] },
      );

      // Edge case: both deck and discard (except top) are completely empty
      if (res.drawn.length === 0) {
        const nextIdx = (state.currentPlayerIndex + 1) % players.length;
        const log = makeLog(
          `Колода порожня! ${activePlayer.name} пропускає хід.`,
          'warning',
        );
        return {
          ...state,
          players,
          deck: res.deck,
          discardPile: res.discardPile,
          phase: 'playing',
          hasDrawnThisTurn: false,
          drawnCardId: null,
          currentPlayerIndex: nextIdx,
          logs: appendLogs(state.logs, log),
        };
      }

      const drawnCard = res.drawn[0];
      const logs: GameLogEntry[] = [];
      if (res.reshuffled) {
        logs.push(makeLog('Колоду перетасовано зі стосу скидання.'));
      }

      if (state.phase === 'must_cover_six') {
        logs.push(makeLog(`${activePlayer.name} тягне карту для покриття 6.`));
        return {
          ...state,
          players,
          deck: res.deck,
          discardPile: res.discardPile,
          drawnCardId: drawnCard.id,
          logs: appendLogs(state.logs, ...logs),
        };
      }

      // Normal 'playing' phase: check if drawn card is playable
      const nextState: GameState = {
        ...state,
        players,
        deck: res.deck,
        discardPile: res.discardPile,
        hasDrawnThisTurn: true,
        drawnCardId: drawnCard.id,
      };

      const drawnPlayable =
        isCardPlayable(drawnCard, nextState) &&
        !(drawnCard.rank === '6' && players[state.currentPlayerIndex].hand.length === 1);

      if (drawnPlayable) {
        logs.push(makeLog(`${activePlayer.name} взяв карту з колоди.`));
        return {
          ...nextState,
          logs: appendLogs(state.logs, ...logs),
        };
      }

      // Drawn card does not fit -> check if player has any other playable card; if not, pass turn
      const hasAny = canPlayerMakeAnyPlay(players[state.currentPlayerIndex], nextState);
      if (!hasAny) {
        const nextIdx = (state.currentPlayerIndex + 1) % players.length;
        logs.push(makeLog(`${activePlayer.name} взяв карту і пасує.`));
        return {
          ...nextState,
          hasDrawnThisTurn: false,
          drawnCardId: null,
          currentPlayerIndex: nextIdx,
          logs: appendLogs(state.logs, ...logs),
        };
      }

      logs.push(makeLog(`${activePlayer.name} взяв карту з колоди.`));
      return {
        ...nextState,
        logs: appendLogs(state.logs, ...logs),
      };
    }

    case 'PASS_TURN': {
      if (state.phase !== 'playing' || !state.hasDrawnThisTurn) {
        return state;
      }
      const nextIdx = (state.currentPlayerIndex + 1) % state.players.length;
      const log = makeLog(`${activePlayer.name} натиснув Пас.`);
      return {
        ...state,
        hasDrawnThisTurn: false,
        drawnCardId: null,
        currentPlayerIndex: nextIdx,
        logs: appendLogs(state.logs, log),
      };
    }

    default:
      return state;
  }
}

/**
 * Strips hidden card identities from opponents' hands before sending state
 * to a specific multiplayer client (anti-cheat).
 */
export function sanitizeStateForPlayer(state: GameState, viewerId: string): GameState {
  if (state.phase === 'round_over' || state.phase === 'match_over') {
    return state;
  }
  return {
    ...state,
    deck: state.deck.map((_, i) => ({ id: `hidden_deck_${i}`, suit: 'spades', rank: '6' })),
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
