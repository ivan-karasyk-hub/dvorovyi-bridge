export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export type Rank = '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

export interface Player {
  id: string;
  name: string;
  hand: Card[];
  score: number;
  connected: boolean;
  isHost?: boolean;
  isBot?: boolean;
  avatarUrl?: string;
}

export interface RoundScoreEntry {
  round: number;
  winnerId: string;
  winnerName: string;
  winReason: 'empty_hand' | 'bridge';
  /** Points added (or subtracted for Jack finish) per playerId in this round */
  deltas: Record<string, number>;
  /** Total scores after this round (with 125->0 reset applied) */
  totals: Record<string, number>;
  resetToZeroPlayerIds: string[];
}

export type TurnPhase =
  | 'playing'         // Active player can play cards or draw
  | 'must_cover_six'  // Active player played a 6 and must cover it in this same turn
  | 'choosing_suit'   // Active player played a Jack and must choose orderedSuit
  | 'round_over'      // Round ended, showing round summary before next round
  | 'match_over';     // Someone reached >= 126 points

export interface GameLogEntry {
  id: string;
  text: string;
  type: 'info' | 'special' | 'bridge' | 'warning';
  timestamp: number;
}

export interface GameState {
  round: number;
  players: Player[];
  dealerIndex: number;
  currentPlayerIndex: number;
  deck: Card[];
  discardPile: Card[];
  activeSuit: Suit;
  orderedSuit: Suit | null;
  phase: TurnPhase;
  hasDrawnThisTurn: boolean;
  drawnCardId: string | null;
  lastPlayedIds: string[];
  roundWinnerId: string | null;
  roundWinReason: 'empty_hand' | 'bridge' | null;
  scoreHistory: RoundScoreEntry[];
  logs: GameLogEntry[];
}

export type GameAction =
  | { type: 'PLAY_CARDS'; playerId: string; cardIds: string[] }
  | { type: 'DRAW_CARD'; playerId: string }
  | { type: 'PASS_TURN'; playerId: string }
  | { type: 'CHOOSE_SUIT'; playerId: string; suit: Suit }
  | { type: 'START_NEXT_ROUND'; playerId: string };

/** Multiplayer WebSocket protocol */
export interface RoomPlayerInfo {
  id: string;
  name: string;
  isHost: boolean;
  isBot?: boolean;
  connected: boolean;
  avatarUrl?: string;
}

export interface RoomInfo {
  code: string;
  players: RoomPlayerInfo[];
  started: boolean;
}

export type ClientMessage =
  | { type: 'CREATE_ROOM'; playerName: string; playerId: string; avatarUrl?: string }
  | { type: 'JOIN_ROOM'; code: string; playerName: string; playerId: string; avatarUrl?: string }
  | { type: 'ADD_BOT'; code: string; playerId: string }
  | { type: 'REMOVE_BOT'; code: string; playerId: string; botId: string }
  | { type: 'START_GAME'; code: string; playerId: string }
  | { type: 'GAME_ACTION'; code: string; action: GameAction }
  | { type: 'LEAVE_ROOM'; code: string; playerId: string };

export type ServerMessage =
  | { type: 'ROOM_STATE'; room: RoomInfo }
  | { type: 'GAME_STATE'; state: GameState }
  | { type: 'ERROR'; message: string };
