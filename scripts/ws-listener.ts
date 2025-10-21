#!/usr/bin/env node

import { WebSocketService, StreamOptions, WebSocketErrorPayload } from '../src/index.js';

type StreamType = 'ticker' | 'trades' | 'klines' | 'bookticker' | 'depth' | 'miniticker';

interface CliOptions {
  symbol?: string;
  stream?: StreamType | string;
  interval?: string;
  timeout?: number;
  heartbeat?: number;
  reconnect?: boolean;
  exitOnError?: boolean;
}

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  return args.reduce<CliOptions>((acc, arg) => {
    const [rawKey, rawValue] = arg.replace(/^--/, '').split('=');
    if (!rawKey) return acc;

    const key = rawKey.toLowerCase();
    const value = rawValue ?? 'true';

    switch (key) {
      case 'symbol':
        acc.symbol = value.toUpperCase();
        break;
      case 'stream':
        acc.stream = value.toLowerCase() as StreamType;
        break;
      case 'interval':
        acc.interval = value;
        break;
      case 'timeout': {
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) {
          acc.timeout = parsed;
        }
        break;
      }
      case 'heartbeat': {
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) {
          acc.heartbeat = parsed;
        }
        break;
      }
      case 'reconnect':
        acc.reconnect = value !== 'false';
        break;
      case 'exitonerror':
        acc.exitOnError = value !== 'false';
        break;
      default:
        break;
    }

    return acc;
  }, {});
};

const options = parseArgs();
const symbol = (options.symbol ?? 'BTCUSDT').toUpperCase();
const streamType = (options.stream ?? 'ticker') as StreamType;
const interval = options.interval ?? '1m';
const connectionTimeout = options.timeout ?? 20_000;
const heartbeatInterval = options.heartbeat ?? 30_000;
const autoReconnect = options.reconnect ?? true;
const shouldExitOnError = options.exitOnError ?? true;

const wsService = new WebSocketService();
let shuttingDown = false;

const streamConfig: StreamOptions = {
  connectionTimeout,
  heartbeatInterval,
  autoReconnect
};

console.log(`🧾 Node version: ${process.version}`);
console.log(`🛣️  Node execPath: ${process.execPath}`);
if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) {
  console.log(`🌐 Proxy detectado: HTTPS_PROXY=${process.env.HTTPS_PROXY ?? ''} HTTP_PROXY=${process.env.HTTP_PROXY ?? ''}`);
}
console.log(`🔌 Conectando a Binance WebSocket | símbolo=${symbol} | stream=${streamType}`);
console.log(`⏱️  Timeout configurado: ${connectionTimeout}ms | 💓 Heartbeat: ${heartbeatInterval}ms | 🔁 Reintentos: ${autoReconnect ? 'ON' : 'OFF'}`);

wsService.on('connected', ({ stream, streams }) => {
  const label = stream ?? streams;
  if (label) {
    console.log(`✅ Evento connected recibido (${label})`);
  }
});

wsService.on('disconnected', ({ stream, streams, code, reason }) => {
  const label = stream ?? streams ?? 'desconocido';
  const reasonText = typeof reason === 'string' ? reason : '';
  console.log(`⚠️  Stream ${label} desconectado (${code}) ${reasonText}`.trim());
});

wsService.on('wsError', ({ stream, streams, error }: WebSocketErrorPayload) => {
  const label = stream ?? streams ?? 'desconocido';
  console.error(`❌ Error en ${label}: ${error.message}`);
  if ((error as NodeJS.ErrnoException).code === 'ERR_SOCKET_CONNECTION_TIMEOUT') {
    console.error('💡 Sugerencia: prueba aumentar el timeout (`npm run ws -- --timeout=30000`) o verifica restricciones de red/firewall.');
  }

  if (shouldExitOnError && !shuttingDown) {
    setTimeout(() => shutdown(1), 0);
  }
});

switch (streamType) {
  case 'ticker':
    wsService.connectToTicker(symbol, (raw) => {
      const data = raw as { c: string; P: string; v: string };
      console.log(
        `[${new Date().toISOString()}] ${symbol} ticker -> price=${Number.parseFloat(data.c).toFixed(2)} change24h=${data.P}% volume=${data.v}`
      );
    }, streamConfig);
    break;
  case 'trades':
    wsService.connectToTrades(
      symbol,
      (trade) => {
        const payload = trade.toJSON();
        console.log(
          `[${new Date().toISOString()}] ${symbol} trade -> price=${payload.price} qty=${payload.quantity} side=${payload.isBuy ? 'BUY' : 'SELL'}`
        );
      },
      streamConfig
    );
    break;
  case 'klines':
    wsService.connectToKlines(
      symbol,
      interval,
      (candle) => {
        const payload = candle.toJSON();
        console.log(
          `[${new Date(payload.openTime).toISOString()}] ${symbol} ${interval} -> O:${payload.open} H:${payload.high} L:${payload.low} C:${payload.close} V:${payload.volume}`
        );
      },
      streamConfig
    );
    break;
  case 'bookticker':
    wsService.connectToBookTicker(
      symbol,
      (data) => {
        console.log(
          `[${new Date().toISOString()}] ${symbol} bookTicker -> bid=${data.b} ask=${data.a}`
        );
      },
      streamConfig
    );
    break;
  case 'depth':
    wsService.connectToOrderBook(
      symbol,
      (data) => {
        const bestBid = data.bids?.[0];
        const bestAsk = data.asks?.[0];
        console.log(
          `[${new Date().toISOString()}] ${symbol} depth -> bestBid=${bestBid?.[0]} bestAsk=${bestAsk?.[0]}`
        );
      },
      streamConfig
    );
    break;
  case 'miniticker':
    wsService.connectToMiniTicker(
      (data) => {
        const ticker = Array.isArray(data) ? data.find((item) => item.s === symbol) : data;
        if (ticker) {
          console.log(`[${new Date().toISOString()}] ${ticker.s} miniTicker -> price=${ticker.c} vol=${ticker.v}`);
        }
      },
      streamConfig
    );
    break;
  default:
    console.error(`❌ Stream no soportado: ${streamType}`);
    process.exit(1);
}

const shutdown = (codeOrSignal: number | string = 0): void => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\n🛑 Cerrando conexiones...');
  wsService.closeAllStreams();
  const exitCode = typeof codeOrSignal === 'number' ? codeOrSignal : 0;
  process.exit(exitCode);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
