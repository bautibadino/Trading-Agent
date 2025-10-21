#!/usr/bin/env node

import chalk from 'chalk';
import Table from 'cli-table3';
import { setTimeout as sleep } from 'node:timers/promises';
import { BinanceClient } from '../src/index.js';
import { Candle } from '../src/models/Candle.js';
import { ScalpingPullbackStrategy, StrategyEvent } from '../src/strategies/ScalpingPullbackStrategy.js';

interface CLIOptions {
  symbol: string;
  interval: string;
  limit: number;
  delay: number;
  fastPeriod: number;
  slowPeriod: number;
  trendPeriod: number;
  atrPeriod: number;
  atrStop: number;
  atrTp: number;
  positionSize: number;
  minAtr: number;
  initialBalance: number;
}

interface PresetConfig {
  description: string;
  config: Partial<CLIOptions>;
}

const PRESETS: Record<string, PresetConfig> = {
  'eth-scalp': {
    description: 'ETH/USDT scalping 1m, 300 velas, retardo 100ms, balance inicial 10k',
    config: {
      symbol: 'ETHUSDT',
      interval: '1m',
      limit: 300,
      delay: 100,
      initialBalance: 10_000
    }
  },
  'btc-default': {
    description: 'BTC/USDT por defecto 1m, 500 velas, sin retardo, balance 0',
    config: {
      symbol: 'BTCUSDT',
      interval: '1m',
      limit: 500,
      delay: 0,
      initialBalance: 0
    }
  },
  'btc-scalp-fast': {
    description: 'BTC/USDT scalping veloz 50ms de retardo, 200 velas',
    config: {
      symbol: 'BTCUSDT',
      interval: '1m',
      limit: 200,
      delay: 50,
      initialBalance: 5_000
    }
  }
};

const normalizeCliArgs = (): Record<string, string> => {
  const args = process.argv.slice(2);
  const normalized: Record<string, string> = {};

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (token === '-h') {
      normalized.help = 'true';
      continue;
    }

    if (!token.startsWith('--')) {
      continue;
    }

    const stripped = token.replace(/^--/, '');
    if (stripped.toLowerCase() === 'help') {
      normalized.help = 'true';
      continue;
    }

    const [rawKey, rawValue] = stripped.split('=');
    const key = rawKey.toLowerCase().replace(/-/g, '');

    if (rawValue !== undefined) {
      normalized[key] = rawValue;
      continue;
    }

    const next = args[index + 1];
    if (next && !next.startsWith('--')) {
      normalized[key] = next;
      index += 1;
    } else {
      normalized[key] = 'true';
    }
  }

  return normalized;
};

const printHelp = (): void => {
  console.log(chalk.cyan.bold('\nUso'));
  console.log('  npm run live -- [opciones]\n');

  const optionTable = new Table({
    head: ['Opción', 'Descripción', 'Ejemplo'],
    style: { head: ['cyan'] },
    wordWrap: true
  });

  optionTable.push(
    ['--symbol', 'Par de trading', 'ETHUSDT'],
    ['--interval', 'Intervalo de velas', '5m'],
    ['--limit', 'Cantidad de velas a descargar', '300'],
    ['--delay', 'Retardo entre velas procesadas (ms)', '100'],
    ['--fast', 'Periodo EMA rápida', '12'],
    ['--slow', 'Periodo EMA lenta', '26'],
    ['--trend', 'Periodo EMA tendencia', '50'],
    ['--atr', 'Periodo ATR', '14'],
    ['--atrstop', 'Multiplicador ATR para Stop Loss', '1.2'],
    ['--atrtp', 'Multiplicador ATR para Take Profit', '1.8'],
    ['--size', 'Tamaño de posición (unidades)', '1'],
    ['--minatr', 'ATR mínimo requerido', '0.25'],
    ['--balance', 'Capital inicial para estadística', '10000'],
    ['--preset', 'Carga una configuración predefinida', 'eth-scalp'],
    ['--help', 'Muestra esta ayuda', '']
  );

  console.log(optionTable.toString());

  console.log('\nPresets disponibles:');
  const presetTable = new Table({
    head: ['Preset', 'Descripción'],
    style: { head: ['cyan'] },
    wordWrap: true
  });

  Object.entries(PRESETS).forEach(([key, preset]) => {
    presetTable.push([key, preset.description]);
  });

  console.log(presetTable.toString());

  console.log('\nEjemplos:');
  console.log('  npm run live:eth');
  console.log('  npm run live -- --preset=eth-scalp --balance 5000');
  console.log('  npm run live -- --symbol ETHUSDT --interval 5m --limit 200\n');
};

const parseCliOptions = (): CLIOptions => {
  const raw = normalizeCliArgs();

  if (raw.help) {
    printHelp();
    process.exit(0);
  }

  const defaults: CLIOptions = {
    symbol: 'BTCUSDT',
    interval: '1m',
    limit: 500,
    delay: 0,
    fastPeriod: 9,
    slowPeriod: 21,
    trendPeriod: 50,
    atrPeriod: 14,
    atrStop: 1.2,
    atrTp: 1.8,
    positionSize: 1,
    minAtr: 0,
    initialBalance: 0
  };

  let options: CLIOptions = { ...defaults };

  const presetKey = raw.preset?.toLowerCase();
  if (presetKey) {
    const preset = PRESETS[presetKey];
    if (!preset) {
      console.error(chalk.red(`Preset desconocido: ${presetKey}`));
      console.log(`Presets disponibles: ${Object.keys(PRESETS).join(', ')}`);
      process.exit(1);
    }
    options = { ...options, ...preset.config };
  }

  const assignString = (apply: (value: string) => void, ...keys: string[]): void => {
    for (const key of keys) {
      const value = raw[key];
      if (value) {
        apply(value);
        break;
      }
    }
  };

  const assignNumber = (apply: (value: number) => void, ...keys: string[]): void => {
    assignString((value) => {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        apply(parsed);
      }
    }, ...keys);
  };

  assignString(
    (value) => {
      options.symbol = value.toUpperCase();
    },
    'symbol',
    'pair'
  );

  assignString(
    (value) => {
      options.interval = value;
    },
    'interval',
    'timeframe'
  );

  assignNumber((value) => {
    options.limit = value;
  }, 'limit', 'candles');

  assignNumber((value) => {
    options.delay = value;
  }, 'delay', 'sleep');

  assignNumber((value) => {
    options.fastPeriod = value;
  }, 'fast', 'fastperiod');

  assignNumber((value) => {
    options.slowPeriod = value;
  }, 'slow', 'slowperiod');

  assignNumber((value) => {
    options.trendPeriod = value;
  }, 'trend', 'trendperiod');

  assignNumber((value) => {
    options.atrPeriod = value;
  }, 'atr', 'atrperiod');

  assignNumber((value) => {
    options.atrStop = value;
  }, 'atrstop', 'stop');

  assignNumber((value) => {
    options.atrTp = value;
  }, 'atrtp', 'take');

  assignNumber((value) => {
    options.positionSize = value;
  }, 'size', 'positionsize');

  assignNumber((value) => {
    options.minAtr = value;
  }, 'minatr', 'atrmin');

  assignNumber((value) => {
    options.initialBalance = value;
  }, 'balance', 'capital', 'initialbalance');

  return options;
};

const options = parseCliOptions();

const client = new BinanceClient();
const initialBalance = options.initialBalance;

const strategy = new ScalpingPullbackStrategy({
  fastPeriod: options.fastPeriod,
  slowPeriod: options.slowPeriod,
  trendPeriod: options.trendPeriod,
  atrPeriod: options.atrPeriod,
  atrStopMultiplier: options.atrStop,
  atrTakeProfitMultiplier: options.atrTp,
  positionSize: options.positionSize,
  minAtr: options.minAtr
});

interface Stats {
  balance: number;
  openPosition?: {
    side: 'LONG' | 'SHORT';
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    atr: number;
  } | null;
  totalTrades: number;
  wins: number;
  losses: number;
  pnl: number;
  maxDrawdown: number;
  peakBalance: number;
}

const stats: Stats = {
  balance: initialBalance,
  openPosition: null,
  totalTrades: 0,
  wins: 0,
  losses: 0,
  pnl: 0,
  maxDrawdown: 0,
  peakBalance: initialBalance
};

const formatCurrency = (value: number): string => value.toFixed(2);
const formatSignedCurrency = (value: number): string => (value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2));
const formatPercent = (value: number): string => `${(value * 100).toFixed(2)}%`;

const createEventTable = () =>
  new Table({
    head: ['Evento', 'Side', 'Precio', 'Stop', 'Take', 'ATR/R', 'PnL', 'Balance'],
    colAligns: ['left', 'left', 'right', 'right', 'right', 'right', 'right', 'right'],
    style: { head: ['white'], border: ['gray'], 'padding-left': 1, 'padding-right': 1 }
  });

const renderConfigSummary = (): void => {
  const configTable = new Table({
    head: ['Parámetro', 'Valor'],
    style: { head: ['cyan'] },
    colAligns: ['left', 'right']
  });

  configTable.push(
    ['Símbolo', options.symbol],
    ['Intervalo', options.interval],
    ['Velas', options.limit.toString()],
    ['Delay (ms)', options.delay.toString()],
    ['EMA rápida', options.fastPeriod.toString()],
    ['EMA lenta', options.slowPeriod.toString()],
    ['EMA tendencia', options.trendPeriod.toString()],
    ['ATR periodo', options.atrPeriod.toString()],
    ['ATR Stop x', options.atrStop.toString()],
    ['ATR TP x', options.atrTp.toString()],
    ['Tamaño posición', options.positionSize.toString()],
    ['ATR mínimo', options.minAtr.toString()],
    ['Balance inicial', formatCurrency(initialBalance)]
  );

  console.log(configTable.toString());
};

const logEvent = (event: StrategyEvent): void => {
  if (event.type === 'ENTRY') {
    const table = createEventTable();
    const label = chalk.bgGreen.black(' ENTRY ');
    const sideLabel = event.side === 'LONG' ? chalk.green(event.side) : chalk.red(event.side);

    stats.openPosition = {
      side: event.side,
      entryPrice: event.price,
      stopLoss: event.stopLoss,
      takeProfit: event.takeProfit,
      atr: event.atr
    };

    table.push([
      label,
      sideLabel,
      formatCurrency(event.price),
      formatCurrency(event.stopLoss),
      formatCurrency(event.takeProfit),
      event.atr.toFixed(2),
      chalk.gray('-'),
      formatCurrency(stats.balance)
    ]);

    console.log(table.toString());
    console.log(chalk.gray(`   Motivo: ${event.reason}\n`));
  } else {
    const table = createEventTable();
    const label = chalk.bgBlue.white(' EXIT ');
    const pnlColor = event.pnl >= 0 ? chalk.green : chalk.red;
    const sideLabel = event.side === 'LONG' ? chalk.green(event.side) : chalk.red(event.side);
    const rLabel = `${event.rMultiple.toFixed(2)}R`;
    const positionSnapshot = stats.openPosition;
    const stopDisplay = positionSnapshot ? formatCurrency(positionSnapshot.stopLoss) : chalk.gray('-');
    const takeDisplay = positionSnapshot ? formatCurrency(positionSnapshot.takeProfit) : chalk.gray('-');

    stats.totalTrades += 1;
    if (event.pnl >= 0) stats.wins += 1;
    else stats.losses += 1;

    const newBalance = stats.balance + event.pnl;
    stats.balance = newBalance;
    stats.pnl += event.pnl;
    stats.openPosition = null;
    stats.peakBalance = Math.max(stats.peakBalance, stats.balance);
    const drawdown = stats.peakBalance - stats.balance;
    stats.maxDrawdown = Math.max(stats.maxDrawdown, drawdown);

    table.push([
      label,
      sideLabel,
      formatCurrency(event.price),
      stopDisplay,
      takeDisplay,
      rLabel,
      pnlColor(formatSignedCurrency(event.pnl)),
      pnlColor(formatCurrency(stats.balance))
    ]);

    console.log(table.toString());
    console.log(chalk.gray(`   Motivo: ${event.reason}\n`));
  }
};

const renderSummary = (): void => {
  const table = new Table({
    head: ['Métrica', 'Valor'],
    style: { head: ['cyan'] }
  });

  const winRate = stats.totalTrades > 0 ? stats.wins / stats.totalTrades : 0;

  table.push(
    ['Capital inicial', formatCurrency(initialBalance)],
    ['Balance acumulado', formatCurrency(stats.balance)],
    ['PnL neto', formatCurrency(stats.pnl)],
    ['Trades totales', stats.totalTrades],
    ['Ganadores', stats.wins],
    ['Perdedores', stats.losses],
    ['Win rate', formatPercent(winRate)],
    ['Max drawdown', formatCurrency(stats.maxDrawdown)]
  );

  console.log('\n' + table.toString());
};

const run = async (): Promise<void> => {
  console.log(chalk.cyan.bold('=== Backtest en vivo: Scalping Pullback ==='));
  renderConfigSummary();
  console.log('\nDescargando datos...\n');

  const klines = await client.getKlines(options.symbol, options.interval, { limit: options.limit });

  for (let index = 0; index < klines.length; index += 1) {
    const candle = klines[index];
    const events = strategy.update(candle, index);

    events.forEach((event) => {
      logEvent(event);
    });

    if (options.delay > 0) {
      await sleep(options.delay);
    }
  }

  const openPos = strategy.getOpenPosition();
  if (openPos) {
    console.log(chalk.yellow('⚠️  Queda una posición abierta al finalizar el backtest.'));
  }

  renderSummary();
};

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(chalk.red(`❌ Error en el backtest: ${message}`));
  process.exit(1);
});
