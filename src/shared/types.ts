export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export type Rank =
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
  | 'playing'              // Active player can play cards or draw
  | 'must_cover_six'       // Active player played a 2 or 6 and must cover it in this same turn
  | 'choosing_suit'        // Active player played a Jack and must choose orderedSuit
  | 'queen_spades_choice'  // Next player chooses: take 5 & skip OR take 8 & play
  | 'eight_split_choice'   // Active player played 2+ 8s with 3+ players: give all to next OR split +2
  | 'bridge_choice'        // 4 same-rank cards on top; player can declare Bridge or keep playing
  | 'round_over'           // Round ended, showing round summary before next round
  | 'match_over';          // Someone reached >= 126 points

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
  bridgeMode?: BridgeMode;
  eightSplitEnabled?: boolean;
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
  | { type: 'CHOOSE_QUEEN_SPADES'; playerId: string; option: 'take5_skip' | 'take8_play' }
  | { type: 'CHOOSE_EIGHT_SPLIT'; playerId: string; mode: 'all_next' | 'split_round' }
  | { type: 'DECLARE_BRIDGE'; playerId: string }
  | { type: 'DECLINE_BRIDGE'; playerId: string }
  | { type: 'START_NEXT_ROUND'; playerId: string }
  | { type: 'REMATCH'; playerId: string };

export type GameType =
  | 'bridge'
  | 'durak'
  | 'holdem'
  | 'blackjack'
  | 'spy'
  | 'crocodile'
  | 'deberts';
export type BridgeMode = 'kalynivskyi' | 'classic';
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
  banned?: boolean;
  nextDailyAt?: number;
}

export interface ServerConfig {
  slotEnabled: boolean;
  bridgeEnabled: boolean;
  durakEnabled: boolean;
  holdemEnabled: boolean;
  blackjackEnabled: boolean;
  spyEnabled: boolean;
  crocodileEnabled: boolean;
  debertsEnabled: boolean;
  trainingEnabled: boolean;
  karasykBrandingEnabled: boolean;
  eightSplitEnabled: boolean;
  bridgeRoundReward: number;
  durakWinReward: number;
  holdemBigBlind: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface BlackjackState {
  playerHand: HoldemCard[];
  dealerHand: HoldemCard[];
  playerScore: number;
  dealerScore: number;
  bet: number;
  phase: 'betting' | 'player_turn' | 'finished';
  outcome: 'win' | 'blackjack' | 'lose' | 'push' | null;
  payout: number;
}

export interface BlackjackPlayerState {
  id: string;
  name: string;
  hand: HoldemCard[];
  score: number;
  bet: number;
  chips: number;
  status: 'betting' | 'playing' | 'stood' | 'busted' | 'blackjack';
  outcome: 'win' | 'blackjack' | 'lose' | 'push' | null;
  payout: number;
  isHost?: boolean;
  isBot?: boolean;
  connected: boolean;
  avatarUrl?: string;
}

export type MultiBlackjackPhase = 'betting' | 'playing' | 'finished';

export interface MultiBlackjackState {
  round: number;
  players: BlackjackPlayerState[];
  dealerHand: HoldemCard[];
  dealerScore: number;
  currentPlayerIndex: number;
  phase: MultiBlackjackPhase;
  logs: GameLogEntry[];
}

export type MultiBlackjackAction =
  | { type: 'BJ_PLACE_BET'; playerId: string; bet: number }
  | { type: 'BJ_HIT'; playerId: string }
  | { type: 'BJ_STAND'; playerId: string }
  | { type: 'BJ_DOUBLE'; playerId: string }
  | { type: 'BJ_NEW_ROUND'; playerId: string };

export interface SpyPlayer {
  id: string;
  name: string;
  isSpy: boolean;
  role: string;
  votedForId: string | null;
  connected: boolean;
  isHost?: boolean;
}

export interface SpyState {
  round: number;
  location: string | null;
  allLocations: string[];
  players: SpyPlayer[];
  phase: 'playing' | 'voting' | 'finished';
  winner: 'citizens' | 'spy' | null;
  winReason: string | null;
  guessedLocation: string | null;
  endsAt: number;
  logs: GameLogEntry[];
}

export type SpyAction =
  | { type: 'SPY_START_VOTE'; playerId: string }
  | { type: 'SPY_VOTE'; playerId: string; targetId: string }
  | { type: 'SPY_GUESS_LOCATION'; playerId: string; location: string }
  | { type: 'SPY_NEW_ROUND'; playerId: string };

export interface CrocodileStroke {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  size: number;
}

export interface CrocodilePlayer {
  id: string;
  name: string;
  score: number;
  connected: boolean;
  isHost?: boolean;
}

export interface CrocodileState {
  round: number;
  drawerIndex: number;
  word: string | null;
  wordLength: number;
  players: CrocodilePlayer[];
  strokes: CrocodileStroke[];
  guesses: Array<{ id: string; playerId: string; playerName: string; text: string; correct: boolean }>;
  phase: 'drawing' | 'round_over';
  winnerId: string | null;
  winnerName: string | null;
  logs: GameLogEntry[];
}

export type CrocodileAction =
  | { type: 'CROCO_DRAW'; playerId: string; stroke: CrocodileStroke }
  | { type: 'CROCO_CLEAR'; playerId: string }
  | { type: 'CROCO_GUESS'; playerId: string; text: string }
  | { type: 'CROCO_SKIP_WORD'; playerId: string }
  | { type: 'CROCO_NEW_ROUND'; playerId: string };

export interface DebertsPlayer {
  id: string;
  name: string;
  hand: Card[];
  roundPoints: number;
  totalScore: number;
  connected: boolean;
  isHost?: boolean;
  isBot?: boolean;
}

export interface DebertsTrickCard {
  playerId: string;
  card: Card;
}

export interface DebertsState {
  round: number;
  players: DebertsPlayer[];
  dealerIndex: number;
  currentPlayerIndex: number;
  proposedTrumpCard: Card | null;
  trumpSuit: Suit;
  callerId: string | null;
  bidRound: 1 | 2;
  trick: DebertsTrickCard[];
  phase: 'bidding' | 'playing' | 'round_over' | 'match_over';
  bellaDeclaredBy: string | null;
  winnerId: string | null;
  logs: GameLogEntry[];
}

export type DebertsAction =
  | { type: 'DEBERTS_ACCEPT_TRUMP'; playerId: string }
  | { type: 'DEBERTS_CHOOSE_TRUMP'; playerId: string; suit: Suit }
  | { type: 'DEBERTS_PASS_BID'; playerId: string }
  | { type: 'DEBERTS_PLAY_CARD'; playerId: string; cardId: string }
  | { type: 'DEBERTS_NEXT_ROUND'; playerId: string }
  | { type: 'DEBERTS_REMATCH'; playerId: string };

export interface AdminOnlinePlayer {
  playerId: string;
  name: string;
  banned: boolean;
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

export interface AdminRoomInfo {
  code: string;
  gameType: GameType;
  isPublic: boolean;
  hasPassword: boolean;
  started: boolean;
  players: RoomPlayerInfo[];
}

export interface PublicRoomSummary {
  code: string;
  gameType: GameType;
  bridgeMode?: BridgeMode;
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
  freeSpinsLeft: number;
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
  bridgeMode?: BridgeMode;
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
      bridgeMode?: BridgeMode;
      durakMode?: DurakMode;
      isPublic?: boolean;
      password?: string;
      autoStart?: boolean;
    }
  | { type: 'JOIN_ROOM'; code: string; playerName: string; playerId: string; avatarUrl?: string; password?: string }
  | { type: 'GET_PUBLIC_ROOMS' }
  | { type: 'SET_ROOM_GAME'; code: string; playerId: string; gameType: GameType; bridgeMode?: BridgeMode; durakMode?: DurakMode }
  | { type: 'ADD_BOT'; code: string; playerId: string }
  | { type: 'REMOVE_BOT'; code: string; playerId: string; botId: string }
  | { type: 'START_GAME'; code: string; playerId: string }
  | { type: 'GAME_ACTION'; code: string; action: GameAction }
  | { type: 'DURAK_ACTION'; code: string; action: DurakAction }
  | { type: 'HOLDEM_ACTION'; code: string; action: HoldemAction }
  | { type: 'MULTI_BJ_ACTION'; code: string; action: MultiBlackjackAction }
  | { type: 'SPY_ACTION'; code: string; action: SpyAction }
  | { type: 'CROCO_ACTION'; code: string; action: CrocodileAction }
  | { type: 'DEBERTS_ACTION'; code: string; action: DebertsAction }
  | { type: 'GET_WALLET'; playerId: string; playerName: string }
  | { type: 'CLAIM_BONUS'; playerId: string; playerName: string }
  | { type: 'CLAIM_DAILY_BONUS'; playerId: string; playerName: string }
  | { type: 'GET_LEADERBOARD' }
  | { type: 'GET_FRIENDS'; playerId: string }
  | { type: 'SEND_FRIEND_REQUEST'; fromId: string; fromName: string; targetId: string }
  | { type: 'RESPOND_FRIEND_REQUEST'; playerId: string; fromId: string; accept: boolean }
  | { type: 'INVITE_FRIEND_TO_ROOM'; fromId: string; fromName: string; friendId: string; code: string }
  | { type: 'SPIN_SLOT'; playerId: string; playerName: string; bet: number; isFreeSpin?: boolean }
  | { type: 'BUY_SLOT_BONUS'; playerId: string; playerName: string; bet: number }
  | { type: 'BJ_DEAL'; playerId: string; playerName: string; bet: number }
  | { type: 'BJ_ACTION'; playerId: string; playerName: string; action: 'hit' | 'stand' | 'double' }
  | { type: 'SEND_ROOM_CHAT'; code: string; playerId: string; playerName: string; text: string }
  | { type: 'SEND_FRIEND_CHAT'; fromId: string; fromName: string; toId: string; text: string }
  | { type: 'GET_FRIEND_CHAT'; playerId: string; friendId: string }
  | { type: 'ADMIN_GET_WALLETS'; adminPlayerId: string }
  | { type: 'ADMIN_ADJUST_CHIPS'; adminPlayerId: string; targetId: string; delta: number }
  | { type: 'ADMIN_GET_ROOMS'; adminPlayerId: string }
  | { type: 'ADMIN_CLOSE_ROOM'; adminPlayerId: string; code: string }
  | { type: 'ADMIN_KICK_PLAYER'; adminPlayerId: string; code: string; targetId: string }
  | { type: 'ADMIN_BROADCAST'; adminPlayerId: string; message: string }
  | { type: 'ADMIN_GIFT_ALL'; adminPlayerId: string; amount: number }
  | { type: 'ADMIN_SET_BAN'; adminPlayerId: string; targetId: string; banned: boolean }
  | { type: 'ADMIN_UPDATE_CONFIG'; adminPlayerId: string; config: Partial<ServerConfig> }
  | { type: 'ADMIN_EXPORT_BACKUP'; adminPlayerId: string }
  | { type: 'ADMIN_IMPORT_BACKUP'; adminPlayerId: string; backupJson: string }
  | { type: 'LEAVE_ROOM'; code: string; playerId: string };

export type ServerMessage =
  | { type: 'ROOM_STATE'; room: RoomInfo }
  | { type: 'ROOM_CLOSED'; reason: string }
  | { type: 'PUBLIC_ROOMS'; rooms: PublicRoomSummary[] }
  | { type: 'GAME_STATE'; state: GameState }
  | { type: 'DURAK_STATE'; state: DurakState }
  | { type: 'HOLDEM_STATE'; state: HoldemState }
  | { type: 'MULTI_BJ_STATE'; state: MultiBlackjackState }
  | { type: 'SPY_STATE'; state: SpyState }
  | { type: 'CROCO_STATE'; state: CrocodileState }
  | { type: 'CROCO_STROKE'; stroke: CrocodileStroke }
  | { type: 'CROCO_CLEAR' }
  | { type: 'DEBERTS_STATE'; state: DebertsState }
  | { type: 'WALLET_UPDATE'; wallet: WalletSummary }
  | { type: 'DAILY_BONUS_RESULT'; amount: number; nextDailyAt: number }
  | { type: 'SERVER_CONFIG'; config: ServerConfig }
  | { type: 'SLOT_RESULT'; result: SlotSpinOutcome }
  | { type: 'BJ_STATE'; state: BlackjackState }
  | { type: 'ROOM_CHAT_MSG'; message: ChatMessage }
  | { type: 'FRIEND_CHAT_HISTORY'; friendId: string; messages: ChatMessage[] }
  | { type: 'FRIEND_CHAT_MSG'; friendId: string; message: ChatMessage }
  | { type: 'LEADERBOARD'; entries: WalletSummary[] }
  | { type: 'FRIENDS_STATE'; friends: FriendEntry[]; incomingRequests: FriendRequestEntry[] }
  | { type: 'ROOM_INVITE'; invite: InGameRoomInvite }
  | { type: 'ADMIN_WALLETS'; entries: WalletSummary[] }
  | { type: 'ADMIN_ROOMS'; rooms: AdminRoomInfo[] }
  | { type: 'ADMIN_ONLINE'; onlineCount: number; players: AdminOnlinePlayer[]; config: ServerConfig }
  | { type: 'ADMIN_BACKUP_DATA'; backupJson: string }
  | { type: 'ADMIN_NOTICE'; message: string }
  | { type: 'ERROR'; message: string };
