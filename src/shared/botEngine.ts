import type { Card, GameAction, GameState, Rank, Suit } from './types';
import { SUITS, checkBridgeOnTop, isCardPlayable, validateSeriesPlay } from './gameEngine';

function pickBestSuitForBot(hand: Card[]): Suit {
  const counts: Record<Suit, number> = {
    spades: 0,
    hearts: 0,
    diamonds: 0,
    clubs: 0,
  };
  for (const card of hand) {
    if (card.rank !== 'J') {
      counts[card.suit] += 1;
    }
  }
  let bestSuit: Suit = 'spades';
  let bestCount = -1;
  for (const suit of SUITS) {
    if (counts[suit] > bestCount) {
      bestCount = counts[suit];
      bestSuit = suit;
    }
  }
  return bestSuit;
}

/**
 * Computes a valid, reasonably smart action for the currently active bot player.
 */
export function chooseBotAction(state: GameState): GameAction | null {
  const bot = state.players[state.currentPlayerIndex];
  if (!bot || !bot.isBot) return null;

  if (state.phase === 'bridge_choice') {
    return {
      type: 'DECLARE_BRIDGE',
      playerId: bot.id,
    };
  }

  if (state.phase === 'choosing_suit') {
    return {
      type: 'CHOOSE_SUIT',
      playerId: bot.id,
      suit: pickBestSuitForBot(bot.hand),
    };
  }

  if (state.phase !== 'playing' && state.phase !== 'must_cover_six') {
    return null;
  }

  // Group bot's hand by rank
  const byRank = new Map<Rank, Card[]>();
  for (const card of bot.hand) {
    const list = byRank.get(card.rank) ?? [];
    list.push(card);
    byRank.set(card.rank, list);
  }

  const candidatePlays: Array<{ cardIds: string[]; score: number }> = [];

  for (const [rank, cards] of byRank.entries()) {
    const playableFirst = cards.filter((c) => isCardPlayable(c, state));
    if (playableFirst.length === 0) continue;

    // Order series so a playable card is first, and if there are 6s, try to end on a suit we can cover
    for (const firstCard of playableFirst) {
      const others = cards.filter((c) => c.id !== firstCard.id);
      const series = [firstCard, ...others];

      // Avoid playing all 6s if it leaves 0 cards (validateSeriesPlay rejects it anyway)
      const check = validateSeriesPlay(
        series.map((c) => c.id),
        bot.hand,
        state,
      );
      if (!check.valid) continue;

      const simulatedDiscard = [...state.discardPile, ...series];
      const completesBridge = checkBridgeOnTop(simulatedDiscard);
      const emptiesHand = series.length === bot.hand.length;

      let score = series.length * 10;
      if (completesBridge) score += 1000;
      if (emptiesHand) score += 500;
      if (rank === 'J' && !emptiesHand) score -= 15; // Save Jack when possible
      if (rank === '6') {
        const lastSix = series[series.length - 1];
        const hasCover = bot.hand.some(
          (c) => !series.some((s) => s.id === c.id) && (c.suit === lastSix.suit || c.rank === '6'),
        );
        score += hasCover ? 5 : -25;
      }

      candidatePlays.push({
        cardIds: series.map((c) => c.id),
        score,
      });
    }
  }

  if (candidatePlays.length > 0) {
    candidatePlays.sort((a, b) => b.score - a.score);
    return {
      type: 'PLAY_CARDS',
      playerId: bot.id,
      cardIds: candidatePlays[0].cardIds,
    };
  }

  if (state.phase === 'playing' && state.hasDrawnThisTurn) {
    return { type: 'PASS_TURN', playerId: bot.id };
  }

  return { type: 'DRAW_CARD', playerId: bot.id };
}
