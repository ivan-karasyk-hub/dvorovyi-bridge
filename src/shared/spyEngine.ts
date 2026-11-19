import type { GameLogEntry, RoomPlayerInfo, SpyAction, SpyPlayer, SpyState } from './types';

interface SpyLocationDef {
  name: string;
  roles: string[];
}

const SPY_LOCATIONS: SpyLocationDef[] = [
  { name: 'Літак', roles: ['Пілот', 'Стюардеса', 'Пасажир', 'Авіамеханік', 'Штурман'] },
  { name: 'Пляж', roles: ['Рятувальник', 'Серфер', 'Турист', 'Продавець морозива', 'Фотограф'] },
  { name: 'Банк', roles: ['Касир', 'Охоронець', 'Керуючий', 'Клієнт', 'Інкасатор'] },
  { name: 'Ресторан', roles: ['Шеф-кухар', 'Офіціант', 'Сомельє', 'Гість', 'Критик'] },
  { name: 'Школа', roles: ['Директор', 'Вчитель', 'Учень', 'Охоронець', 'Бібліотекар'] },
  { name: 'Космічна станція', roles: ['Командир', 'Інженер', 'Астронавт', 'Біолог', 'Радист'] },
  { name: 'Поїзд', roles: ['Машиніст', 'Провідник', 'Пасажир', 'Контролер', 'Продавець кави'] },
  { name: 'Лікарня', roles: ['Хірург', 'Медсестра', 'Пацієнт', 'Терапевт', 'Фармацевт'] },
  { name: 'Супермаркет', roles: ['Касир', 'Охоронець', 'Покупець', 'Мерчендайзер', 'Пекар'] },
  { name: 'Футбольний стадіон', roles: ['Тренер', 'Воротар', 'Арбітр', 'Фанат', 'Коментатор'] },
  { name: 'Підводний човен', roles: ['Капітан', 'Радист', 'Кок', 'Торпедист', 'Механік'] },
  { name: 'Кіностудія', roles: ['Режисер', 'Актор', 'Оператор', 'Гример', 'Каскадер'] },
  { name: 'Театр', roles: ['Актор', 'Режисер', 'Глядач', 'Суфлер', 'Костюмер'] },
  { name: 'Офіс', roles: ['Бос', 'Програміст', 'Менеджер', 'Дизайнер', 'Секретар'] },
  { name: 'Піратський корабель', roles: ['Капітан', 'Штурман', 'Канонір', 'Матрос', 'Кок'] },
  { name: 'Військова база', roles: ['Генерал', 'Сержант', 'Радист', 'Снайпер', 'Медик'] },
];

const ALL_LOCATION_NAMES = SPY_LOCATIONS.map((l) => l.name);

function makeLog(text: string, type: GameLogEntry['type'] = 'info'): GameLogEntry {
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    text,
    type,
    timestamp: Date.now(),
  };
}

export function createSpyMatch(
  roomPlayers: RoomPlayerInfo[],
  round = 1,
  rng: () => number = Math.random,
): SpyState {
  const loc = SPY_LOCATIONS[Math.floor(rng() * SPY_LOCATIONS.length)];
  const spyIdx = Math.floor(rng() * roomPlayers.length);
  const shuffledRoles = [...loc.roles].sort(() => rng() - 0.5);

  const players: SpyPlayer[] = roomPlayers.map((p, idx) => ({
    id: p.id,
    name: p.name,
    isSpy: idx === spyIdx,
    role: idx === spyIdx ? 'Шпигун' : shuffledRoles[idx % shuffledRoles.length],
    votedForId: null,
    connected: p.connected,
    isHost: p.isHost,
  }));

  return {
    round,
    location: loc.name,
    allLocations: ALL_LOCATION_NAMES,
    players,
    phase: 'playing',
    winner: null,
    winReason: null,
    guessedLocation: null,
    endsAt: Date.now() + 5 * 60 * 1000,
    logs: [makeLog(`Раунд ${round}: ролі роздано! Обговоріть і знайдіть шпигуна.`, 'info')],
  };
}

export function sanitizeSpyStateForPlayer(state: SpyState, viewerId: string): SpyState {
  if (state.phase === 'finished') return state;
  const viewer = state.players.find((p) => p.id === viewerId);
  const isViewerSpy = viewer?.isSpy ?? false;
  return {
    ...state,
    location: isViewerSpy ? null : state.location,
    players: state.players.map((p) => ({
      ...p,
      isSpy: p.id === viewerId ? p.isSpy : false,
      role: p.id === viewerId ? p.role : 'Приховано',
    })),
  };
}

export function applySpyAction(
  state: SpyState,
  action: SpyAction,
  rng: () => number = Math.random,
): SpyState {
  if (action.type === 'SPY_NEW_ROUND') {
    if (state.phase !== 'finished') return state;
    const roomPlayers: RoomPlayerInfo[] = state.players.map((p) => ({
      id: p.id,
      name: p.name,
      isHost: Boolean(p.isHost),
      connected: p.connected,
    }));
    return createSpyMatch(roomPlayers, state.round + 1, rng);
  }

  const actor = state.players.find((p) => p.id === action.playerId);
  if (!actor) return state;

  if (action.type === 'SPY_GUESS_LOCATION') {
    if (state.phase === 'finished' || !actor.isSpy) return state;
    const correct = action.location === state.location;
    return {
      ...state,
      phase: 'finished',
      guessedLocation: action.location,
      winner: correct ? 'spy' : 'citizens',
      winReason: correct
        ? `Шпигун (${actor.name}) вгадав локацію «${state.location}»!`
        : `Шпигун (${actor.name}) помилився з локацією («${action.location}» замість «${state.location}»)!`,
      logs: [
        ...state.logs,
        makeLog(
          correct
            ? `Шпигун ${actor.name} вгадав локацію ${state.location}!`
            : `Шпигун ${actor.name} назвав ${action.location} і програв!`,
          'special',
        ),
      ].slice(-20),
    };
  }

  if (action.type === 'SPY_START_VOTE') {
    if (state.phase !== 'playing') return state;
    return {
      ...state,
      phase: 'voting',
      players: state.players.map((p) => ({ ...p, votedForId: null })),
      logs: [...state.logs, makeLog(`${actor.name} запустив голосування!`, 'special')].slice(-20),
    };
  }

  if (action.type === 'SPY_VOTE') {
    if (state.phase !== 'voting') return state;
    const target = state.players.find((p) => p.id === action.targetId);
    if (!target || target.id === actor.id) return state;

    const updatedPlayers = state.players.map((p) =>
      p.id === actor.id ? { ...p, votedForId: target.id } : p,
    );

    const allVoted = updatedPlayers.every((p) => p.votedForId !== null);
    if (!allVoted) {
      return {
        ...state,
        players: updatedPlayers,
        logs: [...state.logs, makeLog(`${actor.name} проголосував.`)].slice(-20),
      };
    }

    const tally = new Map<string, number>();
    for (const p of updatedPlayers) {
      if (p.votedForId) tally.set(p.votedForId, (tally.get(p.votedForId) ?? 0) + 1);
    }
    let topId = updatedPlayers[0].id;
    let topVotes = -1;
    for (const [pid, cnt] of tally.entries()) {
      if (cnt > topVotes) {
        topVotes = cnt;
        topId = pid;
      }
    }
    const accused = updatedPlayers.find((p) => p.id === topId)!;
    const spy = updatedPlayers.find((p) => p.isSpy)!;
    const citizensWon = accused.isSpy;

    return {
      ...state,
      players: updatedPlayers,
      phase: 'finished',
      winner: citizensWon ? 'citizens' : 'spy',
      winReason: citizensWon
        ? `Мирні викрили шпигуна (${spy.name})! Локація: «${state.location}».`
        : `Мирні помилково звинуватили ${accused.name}! Шпигуном був ${spy.name}.`,
      logs: [
        ...state.logs,
        makeLog(
          citizensWon
            ? `Голосування: ${spy.name} викритий!`
            : `Голосування: помилка! Шпигун — ${spy.name}.`,
          'special',
        ),
      ].slice(-20),
    };
  }

  return state;
}
