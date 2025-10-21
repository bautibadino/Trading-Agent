#!/usr/bin/env node

import { BinanceClient } from '../src/index.js';

interface CLIOptions {
  symbol?: string;
  interval?: string;
  limit?: number;
}

const parseArgs = (): CLIOptions => {
  const args = process.argv.slice(2);
  return args.reduce<CLIOptions>((acc, arg) => {
    const [rawKey, rawValue] = arg.replace(/^--/, '').split('=');
    if (!rawKey || rawValue === undefined) {
      return acc;
    }
    switch (rawKey.toLowerCase()) {
      case 'symbol':
        acc.symbol = rawValue.toUpperCase();
        break;
      case 'interval':
        acc.interval = rawValue;
        break;
      case 'limit': {
        const parsed = Number(rawValue);
        if (!Number.isNaN(parsed)) {
          acc.limit = parsed;
        }
        break;
      }
      default:
        break;
    }
    return acc;
  }, {});
};

const options = parseArgs();
const symbol = (options.symbol ?? 'BTCUSDT').toUpperCase();
const interval = options.interval ?? '1h';
const limit = options.limit ?? 5;

const client = new BinanceClient();

const run = async (): Promise<void> => {
  console.log(`🔍 Consultando precio y ${limit} velas ${interval} para ${symbol}...`);

  const price = await client.getCurrentPrice(symbol);
  console.log(`💰 Precio actual ${price.symbol}: $${price.price}`);

  const klines = await client.getKlines(symbol, interval, { limit });
  klines.forEach((candle, idx) => {
    console.log(
      `#${idx + 1} ${new Date(candle.openTime).toISOString()} -> O:${candle.open} H:${candle.high} L:${candle.low} C:${candle.close}`
    );
  });
};

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('❌ Error ejecutando ejemplo REST:', message);
  process.exit(1);
});
