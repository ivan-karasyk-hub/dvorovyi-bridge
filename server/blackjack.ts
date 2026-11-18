import type { BlackjackState, HoldemCard } from '../src/shared/types';
import { createHoldemDeck } from '../src/shared/holdemEngine';
import { addChips, getOrCreateWallet } from './wallet';

interface ActiveBlackjackSession {
  deck: HoldemCard[];
  playerHand: HoldemCard[];
  dealerHand: HoldemCard[];
  bet: number;
}

const sessions = new Map<string, ActiveBlackjackSession>();

export function calculateBlackjackScore(hand: HoldemCard[]): number {
  let sum = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.rank === 'A') {
      sum += 11;
      aces += 1;
    } else if (card.rank === 'K' || card.rank === 'Q' || card.rank === 'J') {
      sum += 10;
    } else {
      sum += Number(card.rank);
    }
  }
  while (sum > 21 && aces > 0) {
    sum -= 10;
    aces -= 1;
  }
  return sum;
}

function toPublicState(
  session: ActiveBlackjackSession,
  phase: BlackjackState['phase'],
  outcome: BlackjackState['outcome'],
  payout: number,
): BlackjackState {
  const visibleDealerHand =
    phase === 'player_turn'
      ? [session.dealerHand[0]]
      : session.dealerHand;
  return {
    playerHand: session.playerHand,
    dealerHand: visibleDealerHand,
    playerScore: calculateBlackjackScore(session.playerHand),
    dealerScore: calculateBlackjackScore(visibleDealerHand),
    bet: session.bet,
    phase,
    outcome,
    payout,
  };
}

export async function dealBlackjack(
  playerId: string,
  playerName: string,
  rawBet: number,
): Promise<{ ok: true; state: BlackjackState; chips: number } | { ok: false; error: string }> {
  const bet = Math.max(10, Math.min(500, Math.trunc(rawBet)));
  const wallet = await getOrCreateWallet(playerId, playerName);
  if (wallet.chips < bet) {
    return { ok: false, error: `Недостатньо фішок (потрібно ${bet}).` };
  }

  let updated = await addChips(playerId, playerName, -bet, false);

  const deck = createHoldemDeck();
  const playerHand = [deck.pop()!, deck.pop()!];
  const dealerHand = [deck.pop()!, deck.pop()!];
  const session: ActiveBlackjackSession = { deck, playerHand, dealerHand, bet };

  const pScore = calculateBlackjackScore(playerHand);
  const dScore = calculateBlackjackScore(dealerHand);

  if (pScore === 21 || dScore === 21) {
    let outcome: BlackjackState['outcome'] = 'lose';
    let payout = 0;
    if (pScore === 21 && dScore === 21) {
      outcome = 'push';
      payout = bet;
    } else if (pScore === 21) {
      outcome = 'blackjack';
      payout = Math.round(bet * 2.5);
    }
    if (payout > 0) {
      updated = await addChips(playerId, playerName, payout, outcome === 'blackjack');
    }
    sessions.delete(playerId);
    return {
      ok: true,
      state: toPublicState(session, 'finished', outcome, payout),
      chips: updated.chips,
    };
  }

  sessions.set(playerId, session);
  return {
    ok: true,
    state: toPublicState(session, 'player_turn', null, 0),
    chips: updated.chips,
  };
}

export async function actBlackjack(
  playerId: string,
  playerName: string,
  action: 'hit' | 'stand' | 'double',
): Promise<{ ok: true; state: BlackjackState; chips: number } | { ok: false; error: string }> {
  const session = sessions.get(playerId);
  if (!session) {
    return { ok: false, error: 'Немає активної роздачі. Зробіть ставку!' };
  }

  let wallet = await getOrCreateWallet(playerId, playerName);

  if (action === 'double') {
    if (session.playerHand.length !== 2) {
      return { ok: false, error: 'Подвоєння доступне лише на перших 2 картах.' };
    }
    if (wallet.chips < session.bet) {
      return { ok: false, error: 'Недостатньо фішок для подвоєння.' };
    }
    wallet = await addChips(playerId, playerName, -session.bet, false);
    session.bet *= 2;
    const card = session.deck.pop();
    if (card) session.playerHand.push(card);
  } else if (action === 'hit') {
    const card = session.deck.pop();
    if (card) session.playerHand.push(card);
    const score = calculateBlackjackScore(session.playerHand);
    if (score > 21) {
      sessions.delete(playerId);
      return {
        ok: true,
        state: toPublicState(session, 'finished', 'lose', 0),
        chips: wallet.chips,
      };
    }
    if (score < 21) {
      return {
        ok: true,
        state: toPublicState(session, 'player_turn', null, 0),
        chips: wallet.chips,
      };
    }
  }

  // Stand (or double / 21 hit): dealer draws to 17
  const pScore = calculateBlackjackScore(session.playerHand);
  if (pScore > 21) {
    sessions.delete(playerId);
    return {
      ok: true,
      state: toPublicState(session, 'finished', 'lose', 0),
      chips: wallet.chips,
    };
  }

  while (calculateBlackjackScore(session.dealerHand) < 17 && session.deck.length > 0) {
    const card = session.deck.pop();
    if (card) session.dealerHand.push(card);
  }

  const dScore = calculateBlackjackScore(session.dealerHand);
  let outcome: BlackjackState['outcome'] = 'lose';
  let payout = 0;
  if (dScore > 21 || pScore > dScore) {
    outcome = 'win';
    payout = session.bet * 2;
  } else if (pScore === dScore) {
    outcome = 'push';
    payout = session.bet;
  }

  if (payout > 0) {
    wallet = await addChips(playerId, playerName, payout, outcome === 'win');
  }
  sessions.delete(playerId);

  return {
    ok: true,
    state: toPublicState(session, 'finished', outcome, payout),
    chips: wallet.chips,
  };
}
