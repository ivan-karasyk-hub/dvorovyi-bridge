import type {
  BlackjackPlayerState,
  GameLogEntry,
  HoldemCard,
  MultiBlackjackAction,
  MultiBlackjackState,
  RoomPlayerInfo,
} from '../src/shared/types';
import { createHoldemDeck } from '../src/shared/holdemEngine';
import { calculateBlackjackScore } from './blackjack';
import { addChips, getOrCreateWallet } from './wallet';

export interface MultiBlackjackSession {
  state: MultiBlackjackState;
  deck: HoldemCard[];
}

function makeLog(text: string, type: GameLogEntry['type'] = 'info'): GameLogEntry {
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    text,
    type,
    timestamp: Date.now(),
  };
}

function createTwoDeckShoe(): HoldemCard[] {
  const shoe = [...createHoldemDeck(), ...createHoldemDeck()];
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe;
}

export function sanitizeMultiBlackjackState(state: MultiBlackjackState): MultiBlackjackState {
  if (state.phase === 'playing') {
    const visibleDealer = state.dealerHand.length > 0 ? [state.dealerHand[0]] : [];
    return {
      ...state,
      dealerHand: visibleDealer,
      dealerScore: calculateBlackjackScore(visibleDealer),
    };
  }
  return state;
}

export async function createMultiBlackjackSession(
  roomPlayers: RoomPlayerInfo[],
): Promise<MultiBlackjackSession> {
  const capped = roomPlayers.slice(0, 4);
  const players: BlackjackPlayerState[] = await Promise.all(
    capped.map(async (p) => {
      let chips = 1000;
      if (!p.isBot) {
        const w = await getOrCreateWallet(p.id, p.name);
        chips = w.chips;
      }
      return {
        id: p.id,
        name: p.name,
        hand: [],
        score: 0,
        bet: p.isBot ? 25 : 0,
        chips: p.isBot ? 975 : chips,
        status: p.isBot ? 'playing' : 'betting',
        outcome: null,
        payout: 0,
        isHost: p.isHost,
        isBot: p.isBot,
        connected: p.connected,
        avatarUrl: p.avatarUrl,
      };
    }),
  );

  const session: MultiBlackjackSession = {
    deck: createTwoDeckShoe(),
    state: {
      round: 1,
      players,
      dealerHand: [],
      dealerScore: 0,
      currentPlayerIndex: 0,
      phase: 'betting',
      logs: [makeLog('Раунд 1: зробіть ставки (10–250 фішок).', 'info')],
    },
  };

  // If all players are bots (unlikely) deal immediately
  if (players.every((p) => p.status !== 'betting')) {
    await dealRoundCards(session);
  }

  return session;
}

async function dealRoundCards(session: MultiBlackjackSession): Promise<void> {
  const { state } = session;
  session.deck = createTwoDeckShoe();

  for (const p of state.players) {
    p.hand = [session.deck.pop()!, session.deck.pop()!];
    p.score = calculateBlackjackScore(p.hand);
    p.outcome = null;
    p.payout = 0;
    p.status = p.score === 21 ? 'blackjack' : 'playing';
  }

  state.dealerHand = [session.deck.pop()!, session.deck.pop()!];
  state.dealerScore = calculateBlackjackScore(state.dealerHand);

  // If dealer has natural 21, settle immediately
  if (state.dealerScore === 21) {
    await settleRound(session, true);
    return;
  }

  const firstPlaying = state.players.findIndex((p) => p.status === 'playing');
  if (firstPlaying === -1) {
    // Everyone got natural blackjack!
    await settleRound(session, false);
    return;
  }

  state.phase = 'playing';
  state.currentPlayerIndex = firstPlaying;
  state.logs = [
    ...state.logs,
    makeLog(`Карти роздано! Хід: ${state.players[firstPlaying].name}`, 'info'),
  ].slice(-20);
}

async function settleRound(
  session: MultiBlackjackSession,
  dealerNaturalBlackjack: boolean,
): Promise<void> {
  const { state } = session;
  const anyStood = state.players.some((p) => p.status === 'stood');

  if (!dealerNaturalBlackjack && anyStood) {
    while (calculateBlackjackScore(state.dealerHand) < 17) {
      const card = session.deck.pop();
      if (!card) break;
      state.dealerHand.push(card);
    }
  }
  state.dealerScore = calculateBlackjackScore(state.dealerHand);
  const dScore = state.dealerScore;

  for (const p of state.players) {
    if (dealerNaturalBlackjack) {
      if (p.status === 'blackjack') {
        p.outcome = 'push';
        p.payout = p.bet;
      } else {
        p.outcome = 'lose';
        p.payout = 0;
      }
    } else if (p.status === 'busted') {
      p.outcome = 'lose';
      p.payout = 0;
    } else if (p.status === 'blackjack') {
      p.outcome = 'blackjack';
      p.payout = Math.round(p.bet * 2.5);
    } else if (dScore > 21 || p.score > dScore) {
      p.outcome = 'win';
      p.payout = p.bet * 2;
    } else if (p.score === dScore) {
      p.outcome = 'push';
      p.payout = p.bet;
    } else {
      p.outcome = 'lose';
      p.payout = 0;
    }

    if (p.payout > 0) {
      if (p.isBot) {
        p.chips += p.payout;
      } else {
        const updated = await addChips(
          p.id,
          p.name,
          p.payout,
          p.outcome === 'win' || p.outcome === 'blackjack',
        );
        p.chips = updated.chips;
      }
    }
  }

  state.phase = 'finished';
  state.logs = [
    ...state.logs,
    makeLog(`Дилер відкрив ${dScore} очок. Раунд завершено!`, 'special'),
  ].slice(-20);
}

async function advanceTurnOrSettle(session: MultiBlackjackSession): Promise<void> {
  const { state } = session;
  for (let i = state.currentPlayerIndex + 1; i < state.players.length; i++) {
    if (state.players[i].status === 'playing') {
      state.currentPlayerIndex = i;
      return;
    }
  }
  await settleRound(session, false);
}

export async function applyMultiBlackjackAction(
  session: MultiBlackjackSession,
  action: MultiBlackjackAction,
): Promise<{ error?: string }> {
  const { state } = session;

  if (action.type === 'BJ_NEW_ROUND') {
    if (state.phase !== 'finished') return { error: 'Раунд ще триває.' };
    state.round += 1;
    state.dealerHand = [];
    state.dealerScore = 0;
    state.currentPlayerIndex = 0;
    state.phase = 'betting';

    for (const p of state.players) {
      p.hand = [];
      p.score = 0;
      p.outcome = null;
      p.payout = 0;
      if (!p.isBot) {
        const w = await getOrCreateWallet(p.id, p.name);
        p.chips = w.chips;
        p.bet = 0;
        p.status = 'betting';
      } else {
        p.bet = 25;
        p.chips = Math.max(0, p.chips - 25);
        p.status = 'playing';
      }
    }

    state.logs = [
      ...state.logs,
      makeLog(`Раунд ${state.round}: зробіть ставки!`, 'info'),
    ].slice(-20);
    return {};
  }

  if (action.type === 'BJ_PLACE_BET') {
    if (state.phase !== 'betting') return { error: 'Зараз не етап ставок.' };
    const player = state.players.find((p) => p.id === action.playerId);
    if (!player) return { error: 'Гравця не знайдено.' };
    if (player.status !== 'betting') return { error: 'Ставку вже зроблено.' };

    const bet = Math.max(10, Math.min(250, Math.trunc(action.bet)));
    if (!player.isBot) {
      const w = await getOrCreateWallet(player.id, player.name);
      if (w.chips < bet) {
        return { error: `Недостатньо фішок (потрібно ${bet}).` };
      }
      const updated = await addChips(player.id, player.name, -bet, false);
      player.chips = updated.chips;
    }
    player.bet = bet;
    player.status = 'playing';
    state.logs = [
      ...state.logs,
      makeLog(`${player.name} поставив ${bet} фішок.`, 'info'),
    ].slice(-20);

    if (state.players.every((p) => p.status !== 'betting')) {
      await dealRoundCards(session);
    }
    return {};
  }

  if (state.phase !== 'playing') {
    return { error: 'Зараз не фаза ходів.' };
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer || currentPlayer.id !== action.playerId) {
    return { error: 'Зараз не ваш хід.' };
  }

  if (action.type === 'BJ_HIT') {
    const card = session.deck.pop();
    if (card) currentPlayer.hand.push(card);
    currentPlayer.score = calculateBlackjackScore(currentPlayer.hand);
    if (currentPlayer.score > 21) {
      currentPlayer.status = 'busted';
      state.logs = [
        ...state.logs,
        makeLog(`${currentPlayer.name} перебрав (${currentPlayer.score})!`, 'warning'),
      ].slice(-20);
      await advanceTurnOrSettle(session);
    } else if (currentPlayer.score === 21) {
      currentPlayer.status = 'stood';
      state.logs = [
        ...state.logs,
        makeLog(`${currentPlayer.name} набрав 21!`, 'special'),
      ].slice(-20);
      await advanceTurnOrSettle(session);
    }
    return {};
  }

  if (action.type === 'BJ_STAND') {
    currentPlayer.status = 'stood';
    state.logs = [
      ...state.logs,
      makeLog(`${currentPlayer.name} зупинився на ${currentPlayer.score}.`, 'info'),
    ].slice(-20);
    await advanceTurnOrSettle(session);
    return {};
  }

  if (action.type === 'BJ_DOUBLE') {
    if (currentPlayer.hand.length !== 2) {
      return { error: 'Подвоєння доступне лише на перших 2 картах.' };
    }
    if (!currentPlayer.isBot) {
      const w = await getOrCreateWallet(currentPlayer.id, currentPlayer.name);
      if (w.chips < currentPlayer.bet) {
        return { error: 'Недостатньо фішок для подвоєння.' };
      }
      const updated = await addChips(currentPlayer.id, currentPlayer.name, -currentPlayer.bet, false);
      currentPlayer.chips = updated.chips;
    } else {
      currentPlayer.chips = Math.max(0, currentPlayer.chips - currentPlayer.bet);
    }
    currentPlayer.bet *= 2;
    const card = session.deck.pop();
    if (card) currentPlayer.hand.push(card);
    currentPlayer.score = calculateBlackjackScore(currentPlayer.hand);
    currentPlayer.status = currentPlayer.score > 21 ? 'busted' : 'stood';
    state.logs = [
      ...state.logs,
      makeLog(
        `${currentPlayer.name} подвоїв ставку (${currentPlayer.bet}) → ${currentPlayer.score}.`,
        currentPlayer.score > 21 ? 'warning' : 'special',
      ),
    ].slice(-20);
    await advanceTurnOrSettle(session);
    return {};
  }

  return {};
}
