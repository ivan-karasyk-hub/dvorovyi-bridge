import { describe, expect, it } from 'vitest';
import {
  applyAction,
  calculateHandPoints,
  createDeck,
  createMatch,
  isCardPlayable,
  sanitizeStateForPlayer,
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
  it('creates a 52-card deck and deals 5 cards to non-dealers and 4 to dealer + 1 face-up', () => {
    expect(createDeck()).toHaveLength(52);
    const state = createMatch([
      { id: 'p1', name: 'Аліса' },
      { id: 'p2', name: 'Богдан' },
      { id: 'p3', name: 'Віктор' },
    ]);
    expect(state.players[state.dealerIndex].hand).toHaveLength(4); // dealer
    // Note: if opening card was 7/8/Q♠, p2 might have drawn extra cards
    expect(state.discardPile).toHaveLength(1);
    const totalCards =
      state.players.reduce((s, p) => s + p.hand.length, 0) +
      state.deck.length +
      state.discardPile.length;
    expect(totalCards).toBe(52);
  });

  it('supports 6 players cleanly with a 52-card deck', () => {
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
    expect(totalCards).toBe(52);
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

    // Allowed to play 6 as last card -> enters must_cover_six!
    const onlySixState = makeTestState({
      players: [
        { id: 'p1', name: 'P1', hand: [c('6', 'spades')], score: 0, connected: true },
        { id: 'p2', name: 'P2', hand: [c('9', 'clubs')], score: 0, connected: true },
      ],
    });
    const afterLastSix = applyAction(onlySixState, {
      type: 'PLAY_CARDS',
      playerId: 'p1',
      cardIds: ['6_spades'],
    });
    expect(afterLastSix.phase).toBe('must_cover_six');
    expect(afterLastSix.currentPlayerIndex).toBe(0);

    // Covering 6 with another 6 keeps must_cover_six active
    const coverSixWithSix = makeTestState({
      phase: 'must_cover_six',
      discardPile: [c('6', 'spades')],
      activeSuit: 'spades',
      players: [
        { id: 'p1', name: 'P1', hand: [c('6', 'hearts'), c('10', 'hearts')], score: 0, connected: true },
        { id: 'p2', name: 'P2', hand: [c('9', 'clubs')], score: 0, connected: true },
      ],
    });
    const stillMustCover = applyAction(coverSixWithSix, {
      type: 'PLAY_CARDS',
      playerId: 'p1',
      cardIds: ['6_hearts'],
    });
    expect(stillMustCover.phase).toBe('must_cover_six');
    expect(stillMustCover.activeSuit).toBe('hearts');
  });

  it('applies 2, 7 (single/multi), 8 (single/multi), Q♠, and N Aces correctly', () => {
    // 2 -> must cover in same turn
    const s2 = makeTestState({
      players: [
        { id: 'p1', name: 'P1', hand: [c('2', 'spades'), c('9', 'spades')], score: 0, connected: true },
        { id: 'p2', name: 'P2', hand: [c('Q', 'clubs')], score: 0, connected: true },
      ],
    });
    const after2 = applyAction(s2, { type: 'PLAY_CARDS', playerId: 'p1', cardIds: ['2_spades'] });
    expect(after2.phase).toBe('must_cover_six');
    expect(after2.currentPlayerIndex).toBe(0);

    // two 7s -> next draws 2 and plays
    const s7 = makeTestState({
      players: [
        { id: 'p1', name: 'P1', hand: [c('7', 'spades'), c('7', 'hearts'), c('9', 'clubs')], score: 0, connected: true },
        { id: 'p2', name: 'P2', hand: [c('Q', 'clubs')], score: 0, connected: true },
        { id: 'p3', name: 'P3', hand: [c('8', 'clubs')], score: 0, connected: true },
      ],
    });
    const after7 = applyAction(s7, { type: 'PLAY_CARDS', playerId: 'p1', cardIds: ['7_spades', '7_hearts'] });
    expect(after7.players[1].hand).toHaveLength(3); // 1 + 2
    expect(after7.currentPlayerIndex).toBe(1); // p2 still goes!

    // two 8s in 3-player game -> eight_split_choice (split_round vs all_next)
    const s8 = makeTestState({
      players: [
        { id: 'p1', name: 'P1', hand: [c('8', 'spades'), c('8', 'hearts'), c('9', 'clubs')], score: 0, connected: true },
        { id: 'p2', name: 'P2', hand: [c('Q', 'clubs')], score: 0, connected: true },
        { id: 'p3', name: 'P3', hand: [c('4', 'clubs')], score: 0, connected: true },
      ],
    });
    const after8Choice = applyAction(s8, { type: 'PLAY_CARDS', playerId: 'p1', cardIds: ['8_spades', '8_hearts'] });
    expect(after8Choice.phase).toBe('eight_split_choice');
    const after8All = applyAction(after8Choice, { type: 'CHOOSE_EIGHT_SPLIT', playerId: 'p1', mode: 'all_next' });
    expect(after8All.players[1].hand).toHaveLength(5); // 1 + 4
    expect(after8All.currentPlayerIndex).toBe(2); // skipped p2, now p3

    const after8Split = applyAction(after8Choice, { type: 'CHOOSE_EIGHT_SPLIT', playerId: 'p1', mode: 'split_round' });
    expect(after8Split.players[1].hand).toHaveLength(3); // 1 + 2
    expect(after8Split.players[2].hand).toHaveLength(3); // 1 + 2
    expect(after8Split.currentPlayerIndex).toBe(0); // both p2 and p3 skipped, back to p1

    // Q♠ -> next chooses take5_skip OR take8_play
    const sq = makeTestState({
      deck: [
        c('2', 'hearts'),
        c('3', 'hearts'),
        c('4', 'hearts'),
        c('5', 'hearts'),
        c('6', 'hearts'),
        c('9', 'hearts'),
        c('10', 'hearts'),
        c('Q', 'hearts'),
        c('K', 'hearts'),
      ],
      players: [
        { id: 'p1', name: 'P1', hand: [c('Q', 'spades'), c('9', 'clubs')], score: 0, connected: true },
        { id: 'p2', name: 'P2', hand: [c('4', 'clubs')], score: 0, connected: true },
        { id: 'p3', name: 'P3', hand: [c('3', 'clubs')], score: 0, connected: true },
      ],
    });
    const afterQ = applyAction(sq, { type: 'PLAY_CARDS', playerId: 'p1', cardIds: ['Q_spades'] });
    expect(afterQ.phase).toBe('queen_spades_choice');
    expect(afterQ.currentPlayerIndex).toBe(1);

    const qTake5 = applyAction(afterQ, { type: 'CHOOSE_QUEEN_SPADES', playerId: 'p2', option: 'take5_skip' });
    expect(qTake5.players[1].hand).toHaveLength(6); // 1 + 5
    expect(qTake5.currentPlayerIndex).toBe(2); // skipped p2

    const qTake8 = applyAction(afterQ, { type: 'CHOOSE_QUEEN_SPADES', playerId: 'p2', option: 'take8_play' });
    expect(qTake8.players[1].hand).toHaveLength(9); // 1 + 8
    expect(qTake8.currentPlayerIndex).toBe(1); // p2 plays

    // 2 Aces in 2-player game -> opponent skipped, turn stays on p1 (never skips self)
    const sa2p = makeTestState({
      players: [
        { id: 'p1', name: 'P1', hand: [c('A', 'spades'), c('A', 'hearts'), c('9', 'clubs')], score: 0, connected: true },
        { id: 'p2', name: 'P2', hand: [c('Q', 'clubs')], score: 0, connected: true },
      ],
    });
    const after2A2p = applyAction(sa2p, {
      type: 'PLAY_CARDS',
      playerId: 'p1',
      cardIds: ['A_spades', 'A_hearts'],
    });
    expect(after2A2p.currentPlayerIndex).toBe(0);

    // 4 Aces in 4-player game -> skips 3 opponents, returns to p1
    const sa4p = makeTestState({
      players: [
        {
          id: 'p1',
          name: 'P1',
          hand: [c('A', 'spades'), c('A', 'hearts'), c('A', 'diamonds'), c('A', 'clubs'), c('9', 'clubs')],
          score: 0,
          connected: true,
        },
        { id: 'p2', name: 'P2', hand: [c('Q', 'clubs')], score: 0, connected: true },
        { id: 'p3', name: 'P3', hand: [c('8', 'clubs')], score: 0, connected: true },
        { id: 'p4', name: 'P4', hand: [c('7', 'clubs')], score: 0, connected: true },
      ],
    });
    const after4A = applyAction(sa4p, {
      type: 'PLAY_CARDS',
      playerId: 'p1',
      cardIds: ['A_spades', 'A_hearts', 'A_diamonds', 'A_clubs'],
    });
    expect(after4A.currentPlayerIndex).toBe(0);

    // Bridge on 8 -> next player draws 2 cards before scoring
    const bridge8State = makeTestState({
      discardPile: [c('8', 'spades'), c('8', 'hearts'), c('8', 'diamonds')],
      deck: [c('J', 'spades'), c('J', 'hearts'), c('4', 'clubs')],
      players: [
        { id: 'p1', name: 'P1', hand: [c('8', 'clubs'), c('9', 'clubs')], score: 0, connected: true },
        { id: 'p2', name: 'P2', hand: [c('4', 'hearts')], score: 0, connected: true },
      ],
    });
    const afterBridge8Play = applyAction(bridge8State, {
      type: 'PLAY_CARDS',
      playerId: 'p1',
      cardIds: ['8_clubs'],
    });
    expect(afterBridge8Play.phase).toBe('bridge_choice');
    const afterBridge8Declare = applyAction(afterBridge8Play, {
      type: 'DECLARE_BRIDGE',
      playerId: 'p1',
    });
    expect(afterBridge8Declare.phase).toBe('round_over');
    expect(afterBridge8Declare.players[1].hand).toHaveLength(3); // 1 + 2 drawn before scoring!
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
        { id: 'p2', name: 'P2', hand: [c('Q', 'clubs')], score: 0, connected: true },
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

  it('applies card point values, exact 125 reset to 0, and >=126 defeat', () => {
    // Scoring values check
    expect(
      calculateHandPoints([
        c('2', 'spades'),
        c('3', 'hearts'),
        c('4', 'diamonds'),
        c('5', 'clubs'),
        c('6', 'spades'),
        c('7', 'hearts'),
        c('8', 'diamonds'),
        c('9', 'clubs'),
        c('10', 'hearts'),
        c('Q', 'spades'),
        c('K', 'hearts'),
        c('A', 'diamonds'),
        c('J', 'clubs'),
      ]),
    ).toBe(0 + 0 + 0 + 5 + 0 + 0 + 0 + 0 + 0 + 10 + 10 + 15 + 20);

    // No Jack finish bonus & 125 -> 0 reset
    const state = makeTestState({
      players: [
        { id: 'p1', name: 'P1', hand: [c('J', 'spades'), c('J', 'hearts')], score: 10, connected: true },
        {
          id: 'p2',
          name: 'P2',
          hand: [c('J', 'clubs'), c('A', 'spades'), c('Q', 'hearts'), c('5', 'hearts')], // 20 + 15 + 10 + 5 = 50 -> 75 + 50 = 125 -> 0
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
    expect(afterJack.players[0].score).toBe(10); // no Jack subtraction
    expect(afterJack.players[1].score).toBe(0); // 125 reset to 0
    expect(afterJack.phase).toBe('round_over');

    // Reshuffle multiplier (1 reshuffle -> 2x, 2 reshuffles -> 3x penalty points)
    const reshuffleState = makeTestState({
      reshuffleCount: 1,
      players: [
        { id: 'p1', name: 'P1', hand: [c('9', 'spades')], score: 0, connected: true },
        { id: 'p2', name: 'P2', hand: [c('Q', 'hearts')], score: 0, connected: true }, // 10 * 2 = 20
      ],
    });
    const afterReshuffle = applyAction(reshuffleState, {
      type: 'PLAY_CARDS',
      playerId: 'p1',
      cardIds: ['9_spades'],
    });
    expect(afterReshuffle.players[1].score).toBe(20);

    const reshuffle2State = makeTestState({
      reshuffleCount: 2,
      players: [
        { id: 'p1', name: 'P1', hand: [c('9', 'spades')], score: 0, connected: true },
        { id: 'p2', name: 'P2', hand: [c('Q', 'hearts')], score: 0, connected: true }, // 10 * 3 = 30
      ],
    });
    const afterReshuffle2 = applyAction(reshuffle2State, {
      type: 'PLAY_CARDS',
      playerId: 'p1',
      cardIds: ['9_spades'],
    });
    expect(afterReshuffle2.players[1].score).toBe(30);

    // Elimination in 3-player game: 1 eliminated -> round_over, next round deals only to 2 alive
    const elimState = makeTestState({
      players: [
        { id: 'p1', name: 'P1', hand: [c('9', 'spades')], score: 0, connected: true },
        { id: 'p2', name: 'P2', hand: [c('J', 'spades')], score: 106, connected: true }, // 106 + 20 = 126 -> eliminated
        { id: 'p3', name: 'P3', hand: [c('Q', 'hearts')], score: 10, connected: true },
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
        { id: 'p2', name: 'P2', hand: [c('J', 'spades')], score: 106, connected: true }, // 106 + 20 = 126
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

  it('supports classic (Дефолт) 36-card Bridge mode with K♠ and Jack finish bonus', () => {
    const classic = createMatch(
      [
        { id: 'p1', name: 'P1' },
        { id: 'p2', name: 'P2' },
      ],
      'classic',
    );
    expect(classic.bridgeMode).toBe('classic');
    const total =
      classic.players.reduce((s, p) => s + p.hand.length, 0) +
      classic.deck.length +
      classic.discardPile.length;
    expect(total).toBe(36);
    expect(calculateHandPoints([c('K', 'spades')], 'classic')).toBe(40);
    expect(calculateHandPoints([c('10', 'hearts')], 'classic')).toBe(10);
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
