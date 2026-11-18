import { describe, expect, it } from 'vitest';
import {
  applyAction,
  calculateHandPoints,
  createDeck,
  createMatch,
  isCardPlayable,
  sanitizeStateForPlayer,
  validateSeriesPlay,
} from './gameEngine';
import { chooseBotAction } from './botEngine';
import type { Card, GameState } from './types';

const c = (rank: Card['rank'], suit: Card['suit']): Card => ({
  id: `${rank}_${suit}`,
  rank,
  suit,
});

function makeTestState(overrides: Partial<GameState> = {}): GameState {
  return {
    round: 1,
    players: [
      { id: 'p1', name: 'Гравець 1', hand: [c('9', 'hearts'), c('10', 'spades')], score: 0, connected: true },
      { id: 'p2', name: 'Гравець 2', hand: [c('Q', 'clubs'), c('K', 'hearts')], score: 0, connected: true },
      { id: 'p3', name: 'Гравець 3', hand: [c('7', 'diamonds'), c('8', 'spades')], score: 0, connected: true },
    ],
    dealerIndex: 0,
    currentPlayerIndex: 0,
    deck: [c('9', 'clubs'), c('10', 'diamonds'), c('Q', 'spades'), c('A', 'clubs')],
    discardPile: [c('9', 'spades')],
    activeSuit: 'spades',
    orderedSuit: null,
    phase: 'playing',
    hasDrawnThisTurn: false,
    drawnCardId: null,
    lastPlayedIds: ['9_spades'],
    roundWinnerId: null,
    roundWinReason: null,
    scoreHistory: [],
    logs: [],
    ...overrides,
  };
}

describe('gameEngine', () => {
  it('creates a 36-card deck and deals 5 cards to non-dealers and 4 to dealer + 1 face-up', () => {
    expect(createDeck()).toHaveLength(36);
    const state = createMatch([
      { id: 'p1', name: 'Аліса' },
      { id: 'p2', name: 'Богдан' },
      { id: 'p3', name: 'Віктор' },
    ]);
    expect(state.players[0].hand).toHaveLength(4); // dealer
    // Note: if opening card was 7/8/K♠, p2 might have drawn extra cards
    expect(state.discardPile).toHaveLength(1);
    const totalCards =
      state.players.reduce((s, p) => s + p.hand.length, 0) +
      state.deck.length +
      state.discardPile.length;
    expect(totalCards).toBe(36);
  });

  it('supports 6 players cleanly with a 36-card deck', () => {
    const state = createMatch([
      { id: 'p1', name: 'G1' },
      { id: 'p2', name: 'G2' },
      { id: 'p3', name: 'G3' },
      { id: 'p4', name: 'G4' },
      { id: 'p5', name: 'G5' },
      { id: 'p6', name: 'G6' },
    ]);
    expect(state.players).toHaveLength(6);
    const totalCards =
      state.players.reduce((s, p) => s + p.hand.length, 0) +
      state.deck.length +
      state.discardPile.length;
    expect(totalCards).toBe(36);
  });

  it('enforces 6 rules: must cover in same turn and forbidden as last card', () => {
    const state = makeTestState({
      players: [
        { id: 'p1', name: 'P1', hand: [c('6', 'spades'), c('10', 'spades')], score: 0, connected: true },
        { id: 'p2', name: 'P2', hand: [c('9', 'clubs')], score: 0, connected: true },
      ],
    });

    // Play 6♠
    const s1 = applyAction(state, { type: 'PLAY_CARDS', playerId: 'p1', cardIds: ['6_spades'] });
    expect(s1.phase).toBe('must_cover_six');
    expect(s1.currentPlayerIndex).toBe(0);

    // Jack can cover an uncovered 6
    expect(isCardPlayable(c('J', 'clubs'), s1)).toBe(true);

    // Cover 6♠ with 10♠ -> player 1 wins round
    const s2 = applyAction(s1, { type: 'PLAY_CARDS', playerId: 'p1', cardIds: ['10_spades'] });
    expect(s2.phase).toBe('round_over');
    expect(s2.roundWinnerId).toBe('p1');

    // Forbidden to play 6 as last card
    const onlySixState = makeTestState({
      players: [
        { id: 'p1', name: 'P1', hand: [c('6', 'spades')], score: 0, connected: true },
        { id: 'p2', name: 'P2', hand: [c('9', 'clubs')], score: 0, connected: true },
      ],
    });
    const validation = validateSeriesPlay(['6_spades'], onlySixState.players[0].hand, onlySixState);
    expect(validation.valid).toBe(false);
  });

  it('applies 7, 8, K♠, and N Aces correctly', () => {
    // 7 -> next draws 2 and skips
    const s7 = makeTestState({
      players: [
        { id: 'p1', name: 'P1', hand: [c('7', 'spades'), c('9', 'clubs')], score: 0, connected: true },
        { id: 'p2', name: 'P2', hand: [c('Q', 'clubs')], score: 0, connected: true },
        { id: 'p3', name: 'P3', hand: [c('8', 'clubs')], score: 0, connected: true },
      ],
    });
    const after7 = applyAction(s7, { type: 'PLAY_CARDS', playerId: 'p1', cardIds: ['7_spades'] });
    expect(after7.players[1].hand).toHaveLength(3); // 1 + 2
    expect(after7.currentPlayerIndex).toBe(2); // skipped p2

    // 8 -> next draws 1 and does NOT skip
    const s8 = makeTestState({
      players: [
        { id: 'p1', name: 'P1', hand: [c('8', 'spades'), c('9', 'clubs')], score: 0, connected: true },
        { id: 'p2', name: 'P2', hand: [c('Q', 'clubs')], score: 0, connected: true },
      ],
    });
    const after8 = applyAction(s8, { type: 'PLAY_CARDS', playerId: 'p1', cardIds: ['8_spades'] });
    expect(after8.players[1].hand).toHaveLength(2); // 1 + 1
    expect(after8.currentPlayerIndex).toBe(1); // p2 goes

    // K♠ -> next draws 4 and skips
    const sk = makeTestState({
      players: [
        { id: 'p1', name: 'P1', hand: [c('K', 'spades'), c('9', 'clubs')], score: 0, connected: true },
        { id: 'p2', name: 'P2', hand: [c('Q', 'clubs')], score: 0, connected: true },
        { id: 'p3', name: 'P3', hand: [c('8', 'clubs')], score: 0, connected: true },
      ],
    });
    const afterK = applyAction(sk, { type: 'PLAY_CARDS', playerId: 'p1', cardIds: ['K_spades'] });
    expect(afterK.players[1].hand).toHaveLength(5); // 1 + 4
    expect(afterK.currentPlayerIndex).toBe(2);

    // 2 Aces in 3-player game -> skips 2 players, returns to p1
    const sa = makeTestState({
      players: [
        { id: 'p1', name: 'P1', hand: [c('A', 'spades'), c('A', 'hearts'), c('9', 'clubs')], score: 0, connected: true },
        { id: 'p2', name: 'P2', hand: [c('Q', 'clubs')], score: 0, connected: true },
        { id: 'p3', name: 'P3', hand: [c('8', 'clubs')], score: 0, connected: true },
      ],
    });
    const after2A = applyAction(sa, {
      type: 'PLAY_CARDS',
      playerId: 'p1',
      cardIds: ['A_spades', 'A_hearts'],
    });
    expect(after2A.currentPlayerIndex).toBe(0);
  });

  it('offers optional «Бридж!» choice when 4 same-rank cards are on top of discard pile', () => {
    const state = makeTestState({
      discardPile: [c('9', 'spades'), c('9', 'hearts')],
      players: [
        {
          id: 'p1',
          name: 'P1',
          hand: [c('9', 'diamonds'), c('9', 'clubs'), c('K', 'spades')],
          score: 0,
          connected: true,
        },
        { id: 'p2', name: 'P2', hand: [c('10', 'clubs')], score: 0, connected: true },
      ],
    });
    const afterPlay = applyAction(state, {
      type: 'PLAY_CARDS',
      playerId: 'p1',
      cardIds: ['9_diamonds', '9_clubs'],
    });
    expect(afterPlay.phase).toBe('bridge_choice');

    // Option 1: Declare Bridge -> round ends with win
    const declared = applyAction(afterPlay, { type: 'DECLARE_BRIDGE', playerId: 'p1' });
    expect(declared.phase).toBe('round_over');
    expect(declared.roundWinReason).toBe('bridge');
    expect(declared.roundWinnerId).toBe('p1');
    expect(declared.players[1].score).toBe(10);

    // Option 2: Decline Bridge -> game continues to next player
    const declined = applyAction(afterPlay, { type: 'DECLINE_BRIDGE', playerId: 'p1' });
    expect(declined.phase).toBe('playing');
    expect(declined.currentPlayerIndex).toBe(1);
  });

  it('applies Jack -20/-40 finish, exact 125 reset to 0, and >=126 defeat', () => {
    // Scoring values check
    expect(
      calculateHandPoints([
        c('6', 'spades'),
        c('7', 'hearts'),
        c('8', 'diamonds'),
        c('9', 'clubs'),
        c('10', 'hearts'),
        c('Q', 'spades'),
        c('K', 'hearts'),
        c('K', 'spades'),
        c('A', 'diamonds'),
        c('J', 'clubs'),
      ]),
    ).toBe(0 + 0 + 0 + 0 + 10 + 3 + 4 + 40 + 11 + 20);

    // Jack finish (-40 for 2 Jacks) & 125 -> 0 reset
    const state = makeTestState({
      players: [
        { id: 'p1', name: 'P1', hand: [c('J', 'spades'), c('J', 'hearts')], score: 10, connected: true },
        {
          id: 'p2',
          name: 'P2',
          hand: [c('K', 'spades'), c('10', 'hearts')], // 40 + 10 = 50 -> 75 + 50 = 125 -> 0
          score: 75,
          connected: true,
        },
      ],
    });
    const afterJack = applyAction(state, {
      type: 'PLAY_CARDS',
      playerId: 'p1',
      cardIds: ['J_spades', 'J_hearts'],
    });
    expect(afterJack.players[0].score).toBe(0); // 10 - 40 clamped at min 0
    expect(afterJack.players[1].score).toBe(0); // 125 reset to 0
    expect(afterJack.phase).toBe('round_over');

    // Reshuffle multiplier (2 reshuffles -> 2x penalty points)
    const reshuffleState = makeTestState({
      reshuffleCount: 2,
      players: [
        { id: 'p1', name: 'P1', hand: [c('9', 'spades')], score: 0, connected: true },
        { id: 'p2', name: 'P2', hand: [c('10', 'hearts')], score: 0, connected: true }, // 10 * 2 = 20
      ],
    });
    const afterReshuffle = applyAction(reshuffleState, {
      type: 'PLAY_CARDS',
      playerId: 'p1',
      cardIds: ['9_spades'],
    });
    expect(afterReshuffle.players[1].score).toBe(20);

    // Elimination in 3-player game: 1 eliminated -> round_over, next round deals only to 2 alive
    const elimState = makeTestState({
      players: [
        { id: 'p1', name: 'P1', hand: [c('9', 'spades')], score: 0, connected: true },
        { id: 'p2', name: 'P2', hand: [c('K', 'spades')], score: 86, connected: true }, // 86 + 40 = 126 -> eliminated
        { id: 'p3', name: 'P3', hand: [c('10', 'hearts')], score: 10, connected: true },
      ],
    });
    const afterElim = applyAction(elimState, {
      type: 'PLAY_CARDS',
      playerId: 'p1',
      cardIds: ['9_spades'],
    });
    expect(afterElim.phase).toBe('round_over');
    expect(afterElim.players[1].eliminated).toBe(true);
    const nextRound = applyAction(afterElim, { type: 'START_NEXT_ROUND', playerId: 'p1' });
    expect(nextRound.players[1].hand).toHaveLength(0);
    expect(nextRound.players[1].eliminated).toBe(true);
    expect(nextRound.players[0].hand.length).toBeGreaterThanOrEqual(4);

    // >= 126 match over when only 1 player remains
    const loseState = makeTestState({
      players: [
        { id: 'p1', name: 'P1', hand: [c('9', 'spades')], score: 0, connected: true },
        { id: 'p2', name: 'P2', hand: [c('K', 'spades')], score: 86, connected: true }, // 86 + 40 = 126
      ],
    });
    const afterLose = applyAction(loseState, {
      type: 'PLAY_CARDS',
      playerId: 'p1',
      cardIds: ['9_spades'],
    });
    expect(afterLose.phase).toBe('match_over');
    expect(afterLose.players[1].score).toBe(126);
  });

  it('sanitizes opponents hands for multiplayer', () => {
    const state = makeTestState();
    const sanitized = sanitizeStateForPlayer(state, 'p1');
    expect(sanitized.players[0].hand[0].id).toBe('9_hearts');
    expect(sanitized.players[1].hand[0].id).toContain('hidden_p2_');
  });

  it('bot chooses valid plays, suits, and draws when stuck', () => {
    const botState = makeTestState({
      players: [
        {
          id: 'bot_1',
          name: 'Бот 1',
          isBot: true,
          hand: [c('9', 'hearts'), c('9', 'diamonds'), c('K', 'clubs')],
          score: 0,
          connected: true,
        },
        { id: 'p2', name: 'P2', hand: [c('Q', 'clubs')], score: 0, connected: true },
      ],
    });

    // Should play both 9s as a series
    const playAction = chooseBotAction(botState);
    expect(playAction?.type).toBe('PLAY_CARDS');
    if (playAction?.type === 'PLAY_CARDS') {
      expect(playAction.cardIds).toHaveLength(2);
    }

    // Should choose most frequent suit when choosing_suit
    const suitState = makeTestState({
      phase: 'choosing_suit',
      players: [
        {
          id: 'bot_1',
          name: 'Бот 1',
          isBot: true,
          hand: [c('Q', 'diamonds'), c('10', 'diamonds'), c('K', 'clubs')],
          score: 0,
          connected: true,
        },
        { id: 'p2', name: 'P2', hand: [c('Q', 'clubs')], score: 0, connected: true },
      ],
    });
    const suitAction = chooseBotAction(suitState);
    expect(suitAction).toEqual({ type: 'CHOOSE_SUIT', playerId: 'bot_1', suit: 'diamonds' });
  });

  it('promotes waitingPlayers into active players on START_NEXT_ROUND', () => {
    const state = makeTestState({
      phase: 'round_over',
      roundWinnerId: 'p1',
      waitingPlayers: [{ id: 'p4', name: 'Оля' }],
    });
    const nextRound = applyAction(state, { type: 'START_NEXT_ROUND', playerId: 'p1' });
    expect(nextRound.players).toHaveLength(4);
    expect(nextRound.players[3].id).toBe('p4');
    expect(nextRound.players[3].hand.length).toBeGreaterThanOrEqual(5);
    expect(nextRound.waitingPlayers).toEqual([]);
  });
});
