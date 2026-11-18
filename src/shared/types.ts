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
  eliminated?: boolean;
  isHost?: boolean;
  isBot?: boolean;
  avatarUrl?: string;
}

export interface RoundScoreEntry {
  round: number;
  winnerId: string;
  winnerName: string;
  winReason: 'empty_hand' | 'bridge';
  reshuffleMultiplier?: number;
  /** Points added (or subtracted for Jack finish) per playerId in this round */
  deltas: Record<string, number>;
  /** Total scores after this round (with 125->0 reset and >=0 floor applied) */
  totals: Record<string, number>;
  resetToZeroPlayerIds: string[];
  eliminatedPlayerIds?: string[];
}

export type TurnPhase =
  | 'playing'         // Active player can play cards or draw
  | 'must_cover_six'  // Active player played a 6 and must cover it in this same turn
  | 'choosing_suit'   // Active player played a Jack and must choose orderedSuit
  | 'bridge_choice'   // 4 same-rank cards on top; player can declare Bridge or keep playing
  | 'round_over'      // Round ended, showing round summary before next round
  | 'match_over';     // Someone reached >= 126 points

export interface GameLogEntry {
  id: string;
  text: string;
  type: 'info' | 'special' | 'bridge' | 'warning';
  timestamp: number;
}

export interface WaitingPlayer {
  id: string;
  name: string;
  isBot?: boolean;
}

export interface GameState {
  round: number;
  players: Player[];
  waitingPlayers?: WaitingPlayer[];
  dealerIndex: number;
  currentPlayerIndex: number;
  deck: Card[];
  discardPile: Card[];
  reshuffleCount?: number;
  activeSuit: Suit;
  orderedSuit: Suit | null;
  phase: TurnPhase;
  hasDrawnThisTurn: boolean;
  drawnCardId: string | null;
  lastPlayedIds: string[];
  lastPlayedCount?: number;
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
  | { type: 'DECLARE_BRIDGE'; playerId: string }
  | { type: 'DECLINE_BRIDGE'; playerId: string }
  | { type: 'START_NEXT_ROUND'; playerId: string }
  | { type: 'REMATCH'; playerId: string };

export type GameType = 'bridge' | 'durak' | 'holdem';
export type DurakMode = 'podkidnoy' | 'perevodnoy';

export type HoldemRank =
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'
  | 'A';

export interface HoldemCard {
  id: string;
  suit: Suit;
  rank: HoldemRank;
}

export type HoldemStreet = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export interface HoldemPlayer {
  id: string;
  name: string;
  hand: HoldemCard[];
  chips: number;
  currentBet: number;
  totalBetInHand: number;
  folded: boolean;
  allIn: boolean;
  actedThisStreet: boolean;
  isHost?: boolean;
  isBot?: boolean;
  connected: boolean;
}

export interface HoldemState {
  players: HoldemPlayer[];
  deck: HoldemCard[];
  communityCards: HoldemCard[];
  pot: number;
  dealerIndex: number;
  currentPlayerIndex: number;
  street: HoldemStreet;
  currentMaxBet: number;
  minRaise: number;
  smallBlind: number;
  bigBlind: number;
  winnerIds: string[];
  winningHandName: string | null;
  logs: GameLogEntry[];
}

export type HoldemAction =
  | { type: 'HOLDEM_FOLD'; playerId: string }
  | { type: 'HOLDEM_CHECK_CALL'; playerId: string }
  | { type: 'HOLDEM_RAISE'; playerId: string; amount: number }
  | { type: 'HOLDEM_ALL_IN'; playerId: string }
  | { type: 'HOLDEM_NEXT_HAND'; playerId: string };

export interface FriendEntry {
  playerId: string;
  name: string;
  online: boolean;
}

export interface FriendRequestEntry {
  fromId: string;
  fromName: string;
}

export interface InGameRoomInvite {
  code: string;
  fromName: string;
  gameType: GameType;
}

export interface WalletSummary {
  playerId: string;
  name: string;
  chips: number;
  wins: number;
  isAdmin?: boolean;
}

export interface DurakTablePair {
  attack: Card;
  defense: Card | null;
}

export interface DurakPlayer {
  id: string;
  name: string;
  hand: Card[];
  isHost?: boolean;
  isBot?: boolean;
  connected: boolean;
  finishedOrder: number | null;
}

export interface DurakState {
  mode: DurakMode;
  players: DurakPlayer[];
  deck: Card[];
  discardCount: number;
  trumpSuit: Suit;
  trumpCard: Card | null;
  attackerIndex: number;
  defenderIndex: number;
  table: DurakTablePair[];
  passedPlayerIds: string[];
  defenderTaking: boolean;
  phase: 'playing' | 'round_over';
  loserId: string | null;
  logs: GameLogEntry[];
}

export type DurakAction =
  | { type: 'ATTACK'; playerId: string; cardId: string }
  | { type: 'DEFEND'; playerId: string; cardId: string; attackIndex: number }
  | { type: 'TRANSFER'; playerId: string; cardId: string }
  | { type: 'PASS_ATTACK'; playerId: string }
  | { type: 'TAKE_CARDS'; playerId: string }
  | { type: 'NEW_DURAK_GAME'; playerId: string };

export interface PublicRoomSummary {
  code: string;
  gameType: GameType;
  durakMode: DurakMode;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  hasPassword: boolean;
  started: boolean;
}

export type SlotSymbol = '🍒' | '🍋' | '🍇' | '🔔' | '💎' | '7️⃣' | '🃏';

export interface SlotSpinOutcome {
  grid: SlotSymbol[][]; // 5 columns x 3 rows
  bet: number;
  cost: number;
  win: number;
  scatterCount: number;
  freeSpinsAwarded: number;
  multiplier: number;
  isBonusPurchase: boolean;
  winningLines: number[];
}

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
  gameType: GameType;
  durakMode: DurakMode;
  isPublic: boolean;
  hasPassword: boolean;
  players: RoomPlayerInfo[];
  started: boolean;
}

export type ClientMessage =
  | {
      type: 'CREATE_ROOM';
      playerName: string;
      playerId: string;
      avatarUrl?: string;
      gameType?: GameType;
      durakMode?: DurakMode;
      isPublic?: boolean;
      password?: string;
    }
  | { type: 'JOIN_ROOM'; code: string; playerName: string; playerId: string; avatarUrl?: string; password?: string }
  | { type: 'GET_PUBLIC_ROOMS' }
  | { type: 'SET_ROOM_GAME'; code: string; playerId: string; gameType: GameType; durakMode?: DurakMode }
  | { type: 'ADD_BOT'; code: string; playerId: string }
  | { type: 'REMOVE_BOT'; code: string; playerId: string; botId: string }
  | { type: 'START_GAME'; code: string; playerId: string }
  | { type: 'GAME_ACTION'; code: string; action: GameAction }
  | { type: 'DURAK_ACTION'; code: string; action: DurakAction }
  | { type: 'HOLDEM_ACTION'; code: string; action: HoldemAction }
  | { type: 'GET_WALLET'; playerId: string; playerName: string }
  | { type: 'CLAIM_BONUS'; playerId: string; playerName: string }
  | { type: 'GET_LEADERBOARD' }
  | { type: 'GET_FRIENDS'; playerId: string }
  | { type: 'SEND_FRIEND_REQUEST'; fromId: string; fromName: string; targetId: string }
  | { type: 'RESPOND_FRIEND_REQUEST'; playerId: string; fromId: string; accept: boolean }
  | { type: 'INVITE_FRIEND_TO_ROOM'; fromId: string; fromName: string; friendId: string; code: string }
  | { type: 'SPIN_SLOT'; playerId: string; playerName: string; bet: number; isFreeSpin?: boolean }
  | { type: 'BUY_SLOT_BONUS'; playerId: string; playerName: string; bet: number }
  | { type: 'ADMIN_GET_WALLETS'; adminPlayerId: string }
  | { type: 'ADMIN_ADJUST_CHIPS'; adminPlayerId: string; targetId: string; delta: number }
  | { type: 'LEAVE_ROOM'; code: string; playerId: string };

export type ServerMessage =
  | { type: 'ROOM_STATE'; room: RoomInfo }
  | { type: 'PUBLIC_ROOMS'; rooms: PublicRoomSummary[] }
  | { type: 'GAME_STATE'; state: GameState }
  | { type: 'DURAK_STATE'; state: DurakState }
  | { type: 'HOLDEM_STATE'; state: HoldemState }
  | { type: 'WALLET_UPDATE'; wallet: WalletSummary }
  | { type: 'SLOT_RESULT'; result: SlotSpinOutcome }
  | { type: 'LEADERBOARD'; entries: WalletSummary[] }
  | { type: 'FRIENDS_STATE'; friends: FriendEntry[]; incomingRequests: FriendRequestEntry[] }
  | { type: 'ROOM_INVITE'; invite: InGameRoomInvite }
  | { type: 'ADMIN_WALLETS'; entries: WalletSummary[] }
  | { type: 'ERROR'; message: string };
