#!/usr/bin/env node

import chalk from 'chalk';
import Table from 'cli-table3';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { BinanceClient } from '../src/index.js';
import { Candle } from '../src/models/Candle.js';
import { WebSocketService } from '../src/services/WebSocketService.js';
import { ScalpingPullbackStrategy } from '../src/strategies/ScalpingPullbackStrategy.js';
import type {
  StrategyConfig,
  StrategyEvent,
  StrategyPosition
} from '../src/strategies/ScalpingPullbackStrategy.js';

type RunMode = 'rest' | 'stream';

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
  mode: RunMode;
  warmup: number;
  connectionTimeout: number;
  preset?: string;
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
    ['--mode', 'Origen de datos: rest (histórico) o stream (WebSocket)', 'stream'],
    ['--warmup', 'Velas históricas para calentar indicadores (solo stream)', '500'],
    ['--timeout', 'Timeout de conexión al WebSocket (ms)', '15000'],
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
  initialBalance: 0,
  mode: 'rest',
  warmup: 500,
  connectionTimeout: 10_000,
  preset: undefined
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
    options.preset = presetKey;
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

  assignString(
    (value) => {
      const normalized = value.toLowerCase();
      if (normalized === 'rest' || normalized === 'stream') {
        options.mode = normalized as RunMode;
      }
    },
    'mode'
  );

  assignNumber((value) => {
    options.limit = value;
  }, 'limit', 'candles');

  assignNumber((value) => {
    options.warmup = value;
  }, 'warmup');

  assignNumber((value) => {
    options.delay = value;
  }, 'delay', 'sleep');

  assignNumber((value) => {
    options.connectionTimeout = value;
  }, 'timeout', 'connectiontimeout');

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

const strategyConfig: StrategyConfig = {
  fastPeriod: options.fastPeriod,
  slowPeriod: options.slowPeriod,
  trendPeriod: options.trendPeriod,
  atrPeriod: options.atrPeriod,
  atrStopMultiplier: options.atrStop,
  atrTakeProfitMultiplier: options.atrTp,
  basePositionSize: options.positionSize,
  positionSize: options.positionSize,
  minAtr: options.minAtr
};

const strategy = new ScalpingPullbackStrategy(strategyConfig);

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

interface RunSummary {
  initialBalance: number;
  finalBalance: number;
  netPnl: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  maxDrawdown: number;
  averageTradePnl: number;
}

type RecordedEvent = StrategyEvent & { source: 'rest' | 'warmup' | 'live' };

interface RunReport {
  metadata: {
    mode: RunMode;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    symbol: string;
    interval: string;
    candlesProcessed: number;
    delayMs: number;
    connectionTimeoutMs: number;
    preset?: string;
    candleWindow: {
      openTime: number | null;
      closeTime: number | null;
      openTimeISO: string | null;
      closeTimeISO: string | null;
    };
    warmupCandles?: number;
    liveCandlesProcessed?: number;
  };
  options: CLIOptions;
  strategyConfig: StrategyConfig;
  stats: Stats;
  summary: RunSummary;
  tradeStatistics: {
    consecutiveWins: number;
    consecutiveLosses: number;
  };
  marketRegime: string;
  events: RecordedEvent[];
  openPosition: StrategyPosition | null;
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

const eventHistory: RecordedEvent[] = [];

const resetStats = (): void => {
  stats.balance = initialBalance;
  stats.openPosition = null;
  stats.totalTrades = 0;
  stats.wins = 0;
  stats.losses = 0;
  stats.pnl = 0;
  stats.maxDrawdown = 0;
  stats.peakBalance = initialBalance;
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
    ['Modo', options.mode],
    ['Velas', options.limit.toString()],
    ['Warmup (velas)', options.warmup.toString()],
    ['Delay (ms)', options.delay.toString()],
    ['Timeout conexión (ms)', options.connectionTimeout.toString()],
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

const logEvent = (
  event: StrategyEvent,
  { source = 'rest', silent = false }: { source?: RecordedEvent['source']; silent?: boolean } = {}
): void => {
  eventHistory.push({ ...event, source } as RecordedEvent);

  if (event.type === 'ENTRY') {
    stats.openPosition = {
      side: event.side,
      entryPrice: event.price,
      stopLoss: event.stopLoss,
      takeProfit: event.takeProfit,
      atr: event.atr
    };

    if (!silent) {
      const table = createEventTable();
      const label = chalk.bgGreen.black(' ENTRY ');
      const sideLabel = event.side === 'LONG' ? chalk.green(event.side) : chalk.red(event.side);

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
    }

    return;
  }

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

  if (!silent) {
    const table = createEventTable();
    const label = chalk.bgBlue.white(' EXIT ');

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

const saveReport = async (report: RunReport, prefix = 'live'): Promise<string> => {
  const reportsDir = join(process.cwd(), 'reports');
  await mkdir(reportsDir, { recursive: true });

  const safeSymbol = report.metadata.symbol.toLowerCase().replace(/[^a-z0-9]/g, '') || 'symbol';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${prefix}-${safeSymbol}-${timestamp}.json`;
  const filePath = join(reportsDir, fileName);

  await writeFile(filePath, JSON.stringify(report, null, 2), 'utf8');
  return filePath;
};

const runRestBacktest = async (): Promise<void> => {
  const startedAt = new Date();

  resetStats();
  eventHistory.length = 0;

  console.log(chalk.cyan.bold('=== Backtest en vivo: Scalping Pullback ==='));
  renderConfigSummary();
  console.log('\nDescargando datos...\n');

  const klines = await client.getKlines(options.symbol, options.interval, { limit: options.limit });

  for (let index = 0; index < klines.length; index += 1) {
    const candle = klines[index];
    const events = strategy.update(candle, index);

    events.forEach((event) => {
      logEvent(event, { source: 'rest' });
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

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();
  const winRate = stats.totalTrades > 0 ? stats.wins / stats.totalTrades : 0;
  const averageTradePnl = stats.totalTrades > 0 ? stats.pnl / stats.totalTrades : 0;
  const statsSnapshot: Stats = {
    ...stats,
    openPosition: stats.openPosition ? { ...stats.openPosition } : null
  };

  const summary: RunSummary = {
    initialBalance,
    finalBalance: stats.balance,
    netPnl: stats.pnl,
    totalTrades: stats.totalTrades,
    wins: stats.wins,
    losses: stats.losses,
    winRate,
    maxDrawdown: stats.maxDrawdown,
    averageTradePnl
  };

  const tradeStatistics = strategy.getTradeStatistics();
  const marketRegime = strategy.getMarketRegime();

  const firstCandle = klines[0] ?? null;
  const lastCandle = klines.length > 0 ? klines[klines.length - 1] : null;

  const report: RunReport = {
    metadata: {
      mode: 'rest',
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs,
      symbol: options.symbol,
      interval: options.interval,
      candlesProcessed: klines.length,
      delayMs: options.delay,
      preset: options.preset,
      warmupCandles: 0,
      connectionTimeoutMs: options.connectionTimeout,
      liveCandlesProcessed: klines.length,
      candleWindow: {
        openTime: firstCandle ? firstCandle.openTime : null,
        closeTime: lastCandle ? lastCandle.closeTime : null,
        openTimeISO: firstCandle ? new Date(firstCandle.openTime).toISOString() : null,
        closeTimeISO: lastCandle ? new Date(lastCandle.closeTime).toISOString() : null
      }
    },
    options: { ...options },
    strategyConfig: { ...strategyConfig },
    stats: statsSnapshot,
    summary,
    tradeStatistics,
    marketRegime,
    events: eventHistory.map((event) => ({ ...event })),
    openPosition: openPos ? { ...openPos } : null
  };

  const reportPath = await saveReport(report, 'live');
  console.log(chalk.cyan(`Reporte guardado en ${reportPath}`));
};

const wsService = new WebSocketService();

let streamShutdownResolver: (() => void) | null = null;
let isShuttingDown = false;

const streamState: {
  warmupCandles: number;
  liveCandlesProcessed: number;
  firstWarmupCandle: Candle | null;
  lastProcessedCandle: Candle | null;
  firstLiveCandle: Candle | null;
  startedAt: Date | null;
  candleIndex: number;
} = {
  warmupCandles: 0,
  liveCandlesProcessed: 0,
  firstWarmupCandle: null,
  lastProcessedCandle: null,
  firstLiveCandle: null,
  startedAt: null,
  candleIndex: 0
};

const applyOpenPositionFromStrategy = (): void => {
  const open = strategy.getOpenPosition();
  if (open) {
    stats.openPosition = {
      side: open.side,
      entryPrice: open.entryPrice,
      stopLoss: open.stopLoss,
      takeProfit: open.takeProfit,
      atr: open.atrAtEntry
    };
  } else {
    stats.openPosition = null;
  }
};

const runLiveStream = async (): Promise<void> => {
  const startedAt = new Date();
  streamState.startedAt = startedAt;

  console.log(chalk.cyan.bold('=== Scalping Pullback | Streaming WebSocket ==='));
  renderConfigSummary();
  console.log('\nPreparando warmup con datos históricos...\n');

  let warmupCandles: Candle[] = [];
  if (options.warmup > 0) {
    warmupCandles = await client.getKlines(options.symbol, options.interval, {
      limit: options.warmup
    });
  }

  streamState.warmupCandles = warmupCandles.length;
  streamState.firstWarmupCandle = warmupCandles[0] ?? null;
  streamState.lastProcessedCandle = warmupCandles.length > 0 ? warmupCandles[warmupCandles.length - 1] : null;

  warmupCandles.forEach((candle, index) => {
    const events = strategy.update(candle, index);
    streamState.candleIndex = index + 1;
    events.forEach((event) => {
      logEvent(event, { source: 'warmup', silent: true });
    });
  });

  resetStats();
  eventHistory.length = 0;
  applyOpenPositionFromStrategy();

  if (streamState.warmupCandles > 0) {
    console.log(
      chalk.cyan(
        `Warmup completado: ${streamState.warmupCandles} velas procesadas antes de iniciar el streaming.`
      )
    );
  } else {
    console.log(chalk.cyan('Sin warmup histórico (warmup=0). Iniciando directamente el streaming.'));
  }

  if (stats.openPosition) {
    console.log(
      chalk.yellow(
        '⚠️  La estrategia mantiene una posición abierta tras el warmup. Se continuará gestionándola en vivo.'
      )
    );
  }

  const symbolStream = `${options.symbol.toLowerCase()}@kline_${options.interval}`;

  const processLiveCandle = (candle: Candle): void => {
    const lastClose = streamState.lastProcessedCandle?.closeTime ?? 0;
    if (candle.closeTime <= lastClose) {
      return;
    }

    streamState.lastProcessedCandle = candle;
    if (!streamState.firstLiveCandle) {
      streamState.firstLiveCandle = candle;
    }

    const events = strategy.update(candle, streamState.candleIndex);
    streamState.candleIndex += 1;
    streamState.liveCandlesProcessed += 1;
    events.forEach((event) => {
      logEvent(event, { source: 'live' });
    });
  };

  wsService.connectToStream(symbolStream, {
    autoReconnect: true,
    connectionTimeout: options.connectionTimeout,
    onOpen: () => {
      console.log(chalk.green(`✅ Conectado al stream ${symbolStream}`));
      console.log(chalk.gray('Presioná CTRL+C para cerrar y guardar el reporte.\n'));
    },
    onError: (error) => {
      console.error(chalk.red(`❌ Error en stream: ${error.message}`));
    },
    onClose: (code, reason) => {
      console.warn(chalk.yellow(`⚠️  Stream cerrado (${code}) - ${reason.toString()}`));
    },
    onMessage: (raw) => {
      try {
        const data = raw as { k?: { [key: string]: unknown } };
        if (!data || !data.k) {
          return;
        }
        const kline = data.k as {
          t: number;
          o: string;
          h: string;
          l: string;
          c: string;
          v: string;
          T: number;
          q: string;
          n: number;
          V: string;
          Q: string;
          B?: unknown;
          x: boolean;
        };
        if (!kline.x) {
          return; // vela aún en formación
        }

        const candle = new Candle({
          openTime: kline.t,
          open: parseFloat(kline.o),
          high: parseFloat(kline.h),
          low: parseFloat(kline.l),
          close: parseFloat(kline.c),
          volume: parseFloat(kline.v),
          closeTime: kline.T,
          quoteVolume: parseFloat(kline.q),
          trades: kline.n,
          takerBuyBaseVolume: parseFloat(kline.V),
          takerBuyQuoteVolume: parseFloat(kline.Q),
          ignore: kline.B
        });

        processLiveCandle(candle);
      } catch (error) {
        console.error(chalk.red(`Error procesando kline: ${(error as Error).message}`));
      }
    }
  });

  const shutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;

    console.log(chalk.yellow(`\nRecibido ${signal}. Cerrando stream y generando reporte...`));
    wsService.closeAllStreams();

    const finishedAt = new Date();
    const durationMs = streamState.startedAt
      ? finishedAt.getTime() - streamState.startedAt.getTime()
      : 0;
    const winRate = stats.totalTrades > 0 ? stats.wins / stats.totalTrades : 0;
    const averageTradePnl = stats.totalTrades > 0 ? stats.pnl / stats.totalTrades : 0;
    const statsSnapshot: Stats = {
      ...stats,
      openPosition: stats.openPosition ? { ...stats.openPosition } : null
    };

    const summary: RunSummary = {
      initialBalance,
      finalBalance: stats.balance,
      netPnl: stats.pnl,
      totalTrades: stats.totalTrades,
      wins: stats.wins,
      losses: stats.losses,
      winRate,
      maxDrawdown: stats.maxDrawdown,
      averageTradePnl
    };

    const tradeStatistics = strategy.getTradeStatistics();
    const marketRegime = strategy.getMarketRegime();

    const firstCandle =
      streamState.firstWarmupCandle ?? streamState.firstLiveCandle ?? streamState.lastProcessedCandle;
    const lastCandle = streamState.lastProcessedCandle;

    const report: RunReport = {
      metadata: {
        mode: 'stream',
        startedAt: streamState.startedAt ? streamState.startedAt.toISOString() : startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs,
        symbol: options.symbol,
        interval: options.interval,
        candlesProcessed: streamState.warmupCandles + streamState.liveCandlesProcessed,
        warmupCandles: streamState.warmupCandles,
        liveCandlesProcessed: streamState.liveCandlesProcessed,
        delayMs: options.delay,
        connectionTimeoutMs: options.connectionTimeout,
        preset: options.preset,
        candleWindow: {
          openTime: firstCandle ? firstCandle.openTime : null,
          closeTime: lastCandle ? lastCandle.closeTime : null,
          openTimeISO: firstCandle ? new Date(firstCandle.openTime).toISOString() : null,
          closeTimeISO: lastCandle ? new Date(lastCandle.closeTime).toISOString() : null
        }
      },
      options: { ...options },
      strategyConfig: { ...strategyConfig },
      stats: statsSnapshot,
      summary,
      tradeStatistics,
      marketRegime,
      events: eventHistory.map((event) => ({ ...event })),
      openPosition: strategy.getOpenPosition()
    };

    renderSummary();

    const reportPath = await saveReport(report, 'live-stream');
    console.log(chalk.cyan(`Reporte guardado en ${reportPath}`));

    if (streamShutdownResolver) {
      streamShutdownResolver();
    }
  };

  const gracefulExit = async (signal: NodeJS.Signals): Promise<void> => {
    await shutdown(signal);
    process.exit(0);
  };

  process.on('SIGINT', (signal) => {
    void gracefulExit(signal);
  });
  process.on('SIGTERM', (signal) => {
    void gracefulExit(signal);
  });

  await new Promise<void>((resolve) => {
    streamShutdownResolver = resolve;
  });
};

const main = async (): Promise<void> => {
  if (options.mode === 'stream') {
    await runLiveStream();
  } else {
    await runRestBacktest();
  }
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(chalk.red(`❌ Error en el backtest: ${message}`));
  process.exit(1);
});
