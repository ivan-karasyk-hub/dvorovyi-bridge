import { describe, expect, it } from 'vitest';
import {
  applyDurakAction,
  canDefendCard,
  canTransferCardInDurak,
  chooseDurakBotAction,
  createDurakMatch,
} from './durakEngine';
import type { Card, DurakState } from './types';

const c = (rank: Card['rank'], suit: Card['suit']): Card => ({
  id: `${rank}_${suit}`,
  rank,
  suit,
});

describe('durakEngine', () => {
  it('deals 6 cards to each player and picks trump suit', () => {
    const state = createDurakMatch(
      [
        { id: 'p1', name: 'P1' },
        { id: 'p2', name: 'P2' },
        { id: 'p3', name: 'P3' },
      ],
      'podkidnoy',
    );
    expect(state.players[0].hand).toHaveLength(6);
    expect(state.players[1].hand).toHaveLength(6);
    expect(state.players[2].hand).toHaveLength(6);
    expect(state.deck).toHaveLength(18);
    expect(state.trumpCard).not.toBeNull();
  });

  it('validates card defense including trumps', () => {
    expect(canDefendCard(c('9', 'hearts'), c('10', 'hearts'), 'spades')).toBe(true);
    expect(canDefendCard(c('10', 'hearts'), c('9', 'hearts'), 'spades')).toBe(false);
    expect(canDefendCard(c('A', 'hearts'), c('6', 'spades'), 'spades')).toBe(true);
    expect(canDefendCard(c('7', 'spades'), c('6', 'spades'), 'spades')).toBe(false);
  });

  it('supports transfer in perevodnoy mode and rejects in podkidnoy', () => {
    const base: DurakState = {
      mode: 'perevodnoy',
      players: [
        { id: 'p1', name: 'P1', hand: [c('8', 'hearts')], connected: true, finishedOrder: null },
        { id: 'p2', name: 'P2', hand: [c('7', 'clubs'), c('9', 'diamonds')], connected: true, finishedOrder: null },
        { id: 'p3', name: 'P3', hand: [c('10', 'spades'), c('J', 'clubs')], connected: true, finishedOrder: null },
      ],
      deck: [],
      discardCount: 0,
      trumpSuit: 'spades',
      trumpCard: null,
      attackerIndex: 0,
      defenderIndex: 1,
      table: [{ attack: c('7', 'hearts'), defense: null }],
      passedPlayerIds: [],
      defenderTaking: false,
      phase: 'playing',
      loserId: null,
      logs: [],
    };

    expect(canTransferCardInDurak(c('7', 'clubs'), 1, base)).toBe(true);
    const transferred = applyDurakAction(base, {
      type: 'TRANSFER',
      playerId: 'p2',
      cardId: '7_clubs',
    });
    expect(transferred.defenderIndex).toBe(2);
    expect(transferred.table).toHaveLength(2);

    const podkidnoy = { ...base, mode: 'podkidnoy' as const };
    expect(canTransferCardInDurak(c('7', 'clubs'), 1, podkidnoy)).toBe(false);
  });

  it('allows bot to defend or take cards cleanly', () => {
    const state: DurakState = {
      mode: 'podkidnoy',
      players: [
        { id: 'p1', name: 'P1', hand: [c('8', 'hearts')], connected: true, finishedOrder: null },
        { id: 'bot_1', name: 'Бот', isBot: true, hand: [c('10', 'hearts')], connected: true, finishedOrder: null },
      ],
      deck: [],
      discardCount: 0,
      trumpSuit: 'spades',
      trumpCard: null,
      attackerIndex: 0,
      defenderIndex: 1,
      table: [{ attack: c('7', 'hearts'), defense: null }],
      passedPlayerIds: [],
      defenderTaking: false,
      phase: 'playing',
      loserId: null,
      logs: [],
    };
    const act = chooseDurakBotAction(state);
    expect(act).toEqual({
      type: 'DEFEND',
      playerId: 'bot_1',
      cardId: '10_hearts',
      attackIndex: 0,
    });
  });
});
