import type {
  CrocodileAction,
  CrocodilePlayer,
  CrocodileState,
  GameLogEntry,
  RoomPlayerInfo,
} from './types';

const CROCODILE_WORDS = [
  'Кіт', 'Собака', 'Сонце', 'Дерево', 'Машина', 'Літак', 'Корабель', 'Будинок',
  'Яблуко', 'Банан', 'Піца', 'Кава', 'Телефон', 'Комп’ютер', 'Гітара', 'Барабан',
  'Велосипед', 'Поїзд', 'Ракета', 'Місяць', 'Зірка', 'Дощ', 'Сніговик', 'Ялинка',
  'Риба', 'Крокодил', 'Слон', 'Жираф', 'Метелик', 'Павук', 'Черепаха', 'Пінґвін',
  'Замок', 'Корона', 'Ключ', 'Окуляри', 'Парасолька', 'Рюкзак', 'Годинник', 'Книга',
  'Футбол', 'Баскетбол', 'Плавання', 'Танці', 'Риболовля', 'Шахи', 'Морозиво', 'Торт',
];

function pickWord(exclude?: string | null, rng: () => number = Math.random): string {
  const pool = CROCODILE_WORDS.filter((w) => w !== exclude);
  return pool[Math.floor(rng() * pool.length)] || CROCODILE_WORDS[0];
}

function makeLog(text: string, type: GameLogEntry['type'] = 'info'): GameLogEntry {
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    text,
    type,
    timestamp: Date.now(),
  };
}

export function createCrocodileMatch(
  roomPlayers: RoomPlayerInfo[],
  rng: () => number = Math.random,
): CrocodileState {
  const word = pickWord(null, rng);
  const players: CrocodilePlayer[] = roomPlayers.map((p) => ({
    id: p.id,
    name: p.name,
    score: 0,
    connected: p.connected,
    isHost: p.isHost,
  }));

  return {
    round: 1,
    drawerIndex: 0,
    word,
    wordLength: word.length,
    players,
    strokes: [],
    guesses: [],
    phase: 'drawing',
    winnerId: null,
    winnerName: null,
    logs: [makeLog(`Раунд 1: малює ${players[0]?.name ?? 'Гравець'}!`, 'info')],
  };
}

export function sanitizeCrocodileStateForPlayer(
  state: CrocodileState,
  viewerId: string,
): CrocodileState {
  const drawer = state.players[state.drawerIndex];
  const canSeeWord = state.phase === 'round_over' || drawer?.id === viewerId;
  return {
    ...state,
    word: canSeeWord ? state.word : null,
  };
}

export function applyCrocodileAction(
  state: CrocodileState,
  action: CrocodileAction,
  rng: () => number = Math.random,
): CrocodileState {
  const drawer = state.players[state.drawerIndex];

  if (action.type === 'CROCO_NEW_ROUND') {
    if (state.phase !== 'round_over') return state;
    const nextDrawer = (state.drawerIndex + 1) % state.players.length;
    const nextWord = pickWord(state.word, rng);
    return {
      ...state,
      round: state.round + 1,
      drawerIndex: nextDrawer,
      word: nextWord,
      wordLength: nextWord.length,
      strokes: [],
      guesses: [],
      phase: 'drawing',
      winnerId: null,
      winnerName: null,
      logs: [
        ...state.logs,
        makeLog(`Раунд ${state.round + 1}: малює ${state.players[nextDrawer]?.name}!`, 'info'),
      ].slice(-20),
    };
  }

  if (state.phase !== 'drawing') return state;

  if (action.type === 'CROCO_SKIP_WORD') {
    if (drawer?.id !== action.playerId || state.strokes.length > 0) return state;
    const nextWord = pickWord(state.word, rng);
    return {
      ...state,
      word: nextWord,
      wordLength: nextWord.length,
    };
  }

  if (action.type === 'CROCO_DRAW') {
    if (drawer?.id !== action.playerId) return state;
    return {
      ...state,
      strokes: [...state.strokes, action.stroke].slice(-2500),
    };
  }

  if (action.type === 'CROCO_CLEAR') {
    if (drawer?.id !== action.playerId) return state;
    return {
      ...state,
      strokes: [],
    };
  }

  if (action.type === 'CROCO_GUESS') {
    if (drawer?.id === action.playerId) return state;
    const player = state.players.find((p) => p.id === action.playerId);
    if (!player) return state;
    const text = action.text.trim().slice(0, 60);
    if (!text) return state;

    const normalizedGuess = text.toLowerCase().replace(/['’`]/g, '');
    const normalizedWord = (state.word ?? '').toLowerCase().replace(/['’`]/g, '');
    const correct = Boolean(normalizedWord) && normalizedGuess === normalizedWord;

    const guessEntry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      playerId: player.id,
      playerName: player.name,
      text,
      correct,
    };

    if (!correct) {
      return {
        ...state,
        guesses: [...state.guesses, guessEntry].slice(-30),
      };
    }

    const updatedPlayers = state.players.map((p, idx) =>
      p.id === player.id || idx === state.drawerIndex ? { ...p, score: p.score + 1 } : p,
    );

    return {
      ...state,
      players: updatedPlayers,
      guesses: [...state.guesses, guessEntry].slice(-30),
      phase: 'round_over',
      winnerId: player.id,
      winnerName: player.name,
      logs: [
        ...state.logs,
        makeLog(`🎉 ${player.name} вгадав слово «${state.word}»!`, 'special'),
      ].slice(-20),
    };
  }

  return state;
}
