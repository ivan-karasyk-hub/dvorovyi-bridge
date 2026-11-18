import type { SlotSpinOutcome, SlotSymbol } from '../src/shared/types';
import { addChips, getOrCreateWallet } from './wallet';

const WEIGHTED_REEL: SlotSymbol[] = [
  '🍒', '🍒', '🍒', '🍒', '🍒',
  '🍋', '🍋', '🍋', '🍋',
  '🍇', '🍇', '🍇', '🍇',
  '🔔', '🔔', '🔔',
  '💎', '💎',
  '7️⃣',
  '🃏', '🃏',
];

// 5 paylines across 5 columns x 3 rows (row indices 0..2)
const PAYLINES: number[][] = [
  [1, 1, 1, 1, 1], // Middle
  [0, 0, 0, 0, 0], // Top
  [2, 2, 2, 2, 2], // Bottom
  [0, 1, 2, 1, 0], // V
  [2, 1, 0, 1, 2], // Inverted V
];

const PAYOUT_TABLE: Record<SlotSymbol, { three: number; four: number; five: number }> = {
  '🍒': { three: 0.6, four: 1.5, five: 4 },
  '🍋': { three: 0.8, four: 2, five: 5 },
  '🍇': { three: 1, four: 2.5, five: 6 },
  '🔔': { three: 1.5, four: 4, five: 10 },
  '💎': { three: 2.5, four: 7, five: 20 },
  '7️⃣': { three: 5, four: 15, five: 50 },
  '🃏': { three: 2, four: 5, five: 15 },
};

const freeSpinsRemaining = new Map<string, number>();

function randomSymbol(excludeScatter = false): SlotSymbol {
  const pool = excludeScatter
    ? WEIGHTED_REEL.filter((s) => s !== '🃏')
    : WEIGHTED_REEL;
  return pool[Math.floor(Math.random() * pool.length)];
}

function generateGrid(forceScatters = 0): SlotSymbol[][] {
  const grid: SlotSymbol[][] = [];
  for (let col = 0; col < 5; col++) {
    const column: SlotSymbol[] = [];
    for (let row = 0; row < 3; row++) {
      column.push(randomSymbol(false));
    }
    grid.push(column);
  }

  if (forceScatters > 0) {
    const cols = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5).slice(0, forceScatters);
    for (const c of cols) {
      const r = Math.floor(Math.random() * 3);
      grid[c][r] = '🃏';
    }
  }
  return grid;
}

function evaluateGrid(
  grid: SlotSymbol[][],
  bet: number,
  multiplier: number,
  isBonusPurchase: boolean,
  cost: number,
): SlotSpinOutcome {
  let totalWin = 0;
  const winningLines: number[] = [];

  PAYLINES.forEach((line, lineIdx) => {
    const first = grid[0][line[0]];
    if (first === '🃏') return;
    let matchCount = 1;
    for (let col = 1; col < 5; col++) {
      const sym = grid[col][line[col]];
      if (sym === first || sym === '🃏') {
        matchCount++;
      } else {
        break;
      }
    }
    if (matchCount >= 3) {
      winningLines.push(lineIdx);
      const table = PAYOUT_TABLE[first];
      const factor =
        matchCount === 5 ? table.five : matchCount === 4 ? table.four : table.three;
      totalWin += Math.round(bet * factor * multiplier);
    }
  });

  let scatterCount = 0;
  for (let col = 0; col < 5; col++) {
    for (let row = 0; row < 3; row++) {
      if (grid[col][row] === '🃏') scatterCount++;
    }
  }

  let freeSpinsAwarded = 0;
  if (scatterCount >= 3) {
    freeSpinsAwarded = scatterCount >= 4 ? 12 : 8;
    const scTable = PAYOUT_TABLE['🃏'];
    const scFactor =
      scatterCount >= 5 ? scTable.five : scatterCount === 4 ? scTable.four : scTable.three;
    totalWin += Math.round(bet * scFactor * multiplier);
  }

  return {
    grid,
    bet,
    cost,
    win: totalWin,
    scatterCount,
    freeSpinsAwarded,
    multiplier,
    isBonusPurchase,
    winningLines,
  };
}

export async function executeSlotSpin(
  playerId: string,
  playerName: string,
  rawBet: number,
  buyBonus: boolean,
): Promise<{ ok: true; result: SlotSpinOutcome; chips: number } | { ok: false; error: string }> {
  const bet = Math.max(10, Math.min(500, Math.trunc(rawBet)));
  const wallet = await getOrCreateWallet(playerId, playerName);

  const serverFreeSpins = freeSpinsRemaining.get(playerId) ?? 0;
  const usingFreeSpin = !buyBonus && serverFreeSpins > 0;

  const cost = buyBonus ? bet * 50 : usingFreeSpin ? 0 : bet;
  if (wallet.chips < cost) {
    return { ok: false, error: `Недостатньо фішок (потрібно ${cost}).` };
  }

  let nextFreeSpins = serverFreeSpins;
  if (usingFreeSpin) {
    nextFreeSpins = Math.max(0, nextFreeSpins - 1);
  }

  const multiplier = usingFreeSpin ? [2, 2, 3, 4, 5][Math.floor(Math.random() * 5)] : 1;
  const grid = generateGrid(buyBonus ? 3 : 0);
  const result = evaluateGrid(grid, bet, multiplier, buyBonus, cost);

  if (result.freeSpinsAwarded > 0) {
    nextFreeSpins += result.freeSpinsAwarded;
  }
  freeSpinsRemaining.set(playerId, nextFreeSpins);

  const netDelta = result.win - cost;
  const updated = await addChips(playerId, playerName, netDelta, false);

  return { ok: true, result, chips: updated.chips };
}
