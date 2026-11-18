import { describe, expect, it } from 'vitest';
import {
  applyHoldemAction,
  createHoldemDeck,
  createHoldemMatch,
  evaluateBestHand,
} from './holdemEngine';
import type { HoldemCard } from './types';

const hc = (rank: HoldemCard['rank'], suit: HoldemCard['suit']): HoldemCard => ({
  id: `${rank}_${suit}`,
  rank,
  suit,
});

describe('holdemEngine', () => {
  it('creates a 52-card deck and deals 2 hole cards + posts blinds', () => {
    expect(createHoldemDeck()).toHaveLength(52);
    const state = createHoldemMatch([
      { id: 'p1', name: 'P1', chips: 1000 },
      { id: 'p2', name: 'P2', chips: 1000 },
      { id: 'p3', name: 'P3', chips: 1000 },
    ]);
    expect(state.players[0].hand).toHaveLength(2);
    expect(state.players[1].hand).toHaveLength(2);
    expect(state.pot).toBe(30); // SB 10 + BB 20
    expect(state.street).toBe('preflop');
  });

  it('evaluates poker hand rankings accurately', () => {
    const royal = evaluateBestHand([
      hc('A', 'spades'),
      hc('K', 'spades'),
      hc('Q', 'spades'),
      hc('J', 'spades'),
      hc('10', 'spades'),
      hc('2', 'hearts'),
      hc('3', 'clubs'),
    ]);
    expect(royal.name).toBe('Роял-флеш');

    const fullHouse = evaluateBestHand([
      hc('K', 'spades'),
      hc('K', 'hearts'),
      hc('K', 'diamonds'),
      hc('9', 'clubs'),
      hc('9', 'spades'),
      hc('2', 'clubs'),
      hc('4', 'hearts'),
    ]);
    expect(fullHouse.name).toBe('Фул-хаус');

    const wheel = evaluateBestHand([
      hc('A', 'clubs'),
      hc('2', 'hearts'),
      hc('3', 'diamonds'),
      hc('4', 'spades'),
      hc('5', 'clubs'),
      hc('J', 'hearts'),
      hc('9', 'diamonds'),
    ]);
    expect(wheel.name).toBe('Стріт');
  });

  it('awards pot when all opponents fold', () => {
    const state = createHoldemMatch([
      { id: 'p1', name: 'P1', chips: 1000 },
      { id: 'p2', name: 'P2', chips: 1000 },
    ]);
    const activeId = state.players[state.currentPlayerIndex].id;
    const afterFold = applyHoldemAction(state, { type: 'HOLDEM_FOLD', playerId: activeId });
    expect(afterFold.street).toBe('showdown');
    expect(afterFold.winnerIds).toHaveLength(1);
    const winner = afterFold.players.find((p) => p.id === afterFold.winnerIds[0])!;
    expect(winner.chips).toBe(1010);
  });
});
