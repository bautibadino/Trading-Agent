#!/usr/bin/env node

import { WebSocketService, StreamOptions, WebSocketErrorPayload } from '../src/index.js';

type StreamType = 'ticker' | 'trades' | 'klines' | 'bookticker' | 'depth' | 'miniticker' | 'full' | 'ai-data';

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
  case 'full':
  case 'ai-data': {
    console.log('\n🤖 MODO AI-DATA COMPLETO - Capturando TODOS los datos disponibles\n');
    console.log('📊 Streams activos:');
    console.log('   • aggTrade - Trades agregados con lado comprador/vendedor');
    console.log('   • markPrice@1s - Mark Price, Index Price, Funding Rate');
    console.log('   • kline_1m - Velas OHLCV con volumen taker');
    console.log('   • ticker - Ticker 24h completo con estadísticas');
    console.log('   • bookTicker - Mejor Bid/Ask en tiempo real');
    console.log('   • depth5@100ms - Top 5 niveles del libro de órdenes');
    console.log('   • forceOrder - Liquidaciones (cuando ocurren)\n');

    const symbolLower = symbol.toLowerCase();
    const streams = [
      `${symbolLower}@aggTrade`,
      `${symbolLower}@markPrice@1s`,
      `${symbolLower}@kline_${interval}`,
      `${symbolLower}@ticker`,
      `${symbolLower}@bookTicker`,
      `${symbolLower}@depth5@100ms`,
      `${symbolLower}@forceOrder`
    ];

    // Acumuladores para mostrar estadísticas
    let aggTradeCount = 0;
    let buyVolume = 0;
    let sellVolume = 0;
    let lastPrice = 0;
    let lastMarkPrice = 0;
    let lastIndexPrice = 0;
    let lastFundingRate = 0;
    let lastSpread = 0;
    let lastImbalance = 0;
    let liquidationCount = 0;

    wsService.connectToMultipleStreams(streams, {
      ...streamConfig,
      onMessage: (envelope) => {
        const streamName = envelope.stream as string;
        const data = envelope.data;
        const timestamp = new Date().toISOString();

        // ========== 1. AGG TRADE - Trades agregados ==========
        if (streamName.includes('@aggTrade')) {
          aggTradeCount++;
          const isBuyerMaker = data.m as boolean;
          const price = parseFloat(data.p as string);
          const qty = parseFloat(data.q as string);
          const volume = price * qty;
          
          lastPrice = price;
          
          if (isBuyerMaker) {
            // Buyer es maker = alguien vendió agresivamente
            sellVolume += volume;
          } else {
            // Buyer es taker = alguien compró agresivamente
            buyVolume += volume;
          }

          const side = isBuyerMaker ? 'SELL' : 'BUY';
          const sideEmoji = isBuyerMaker ? '🔴' : '🟢';
          
          console.log(`${sideEmoji} [AGGTRADE] ${timestamp}`);
          console.log(`   Price: ${price.toFixed(2)} | Qty: ${qty.toFixed(6)} | Volume: $${volume.toFixed(2)}`);
          console.log(`   Side: ${side} (taker) | Trade ID: ${data.a} | First: ${data.f} | Last: ${data.l}`);
          console.log(`   📈 Acumulado - Buy: $${buyVolume.toFixed(2)} | Sell: $${sellVolume.toFixed(2)} | Ratio: ${(buyVolume / (sellVolume || 1)).toFixed(2)}`);
          console.log('');
        }

        // ========== 2. MARK PRICE - Funding & Basis ==========
        else if (streamName.includes('@markPrice')) {
          const markPrice = parseFloat(data.p as string);
          const indexPrice = parseFloat(data.i as string);
          const fundingRate = parseFloat(data.r as string);
          const nextFundingTime = new Date(data.T as number).toISOString();
          const estSettlePrice = data.P ? parseFloat(data.P as string) : null;

          lastMarkPrice = markPrice;
          lastIndexPrice = indexPrice;
          lastFundingRate = fundingRate;

          const basis = markPrice - indexPrice;
          const basisPercent = ((basis / indexPrice) * 100).toFixed(4);
          const fundingPercent = (fundingRate * 100).toFixed(4);

          console.log(`💰 [MARK PRICE] ${timestamp}`);
          console.log(`   Mark Price: ${markPrice.toFixed(2)} | Index Price: ${indexPrice.toFixed(2)}`);
          console.log(`   Basis: ${basis.toFixed(2)} (${basisPercent}%) ${parseFloat(basisPercent) > 0 ? '📈 Premium' : '📉 Discount'}`);
          console.log(`   Funding Rate: ${fundingPercent}% | Next Funding: ${nextFundingTime}`);
          if (estSettlePrice) {
            console.log(`   Estimated Settle: ${estSettlePrice.toFixed(2)}`);
          }
          console.log('');
        }

        // ========== 3. KLINE - Velas OHLCV ==========
        else if (streamName.includes('@kline')) {
          const k = data.k;
          const open = parseFloat(k.o as string);
          const high = parseFloat(k.h as string);
          const low = parseFloat(k.l as string);
          const close = parseFloat(k.c as string);
          const volume = parseFloat(k.v as string);
          const quoteVolume = parseFloat(k.q as string);
          const takerBuyBaseVol = parseFloat(k.V as string);
          const takerBuyQuoteVol = parseFloat(k.Q as string);
          const trades = k.n as number;
          const isClosed = k.x as boolean;

          const change = close - open;
          const changePercent = ((change / open) * 100).toFixed(2);
          const takerBuyPercent = ((takerBuyBaseVol / volume) * 100).toFixed(2);
          
          const candleEmoji = isClosed ? '🕯️ ' : '⏳';
          const directionEmoji = change >= 0 ? '🟢' : '🔴';

          console.log(`${candleEmoji} [KLINE ${k.i}] ${timestamp} ${isClosed ? '✅ CLOSED' : '🔄 IN PROGRESS'}`);
          console.log(`   OHLC: O:${open.toFixed(2)} H:${high.toFixed(2)} L:${low.toFixed(2)} C:${close.toFixed(2)}`);
          console.log(`   ${directionEmoji} Change: ${change.toFixed(2)} (${changePercent}%)`);
          console.log(`   📊 Volume: ${volume.toFixed(4)} ${symbol.replace('USDT', '')} | Quote: $${quoteVolume.toFixed(2)}`);
          console.log(`   🔥 Taker Buy: ${takerBuyBaseVol.toFixed(4)} (${takerBuyPercent}%) | Quote: $${takerBuyQuoteVol.toFixed(2)}`);
          console.log(`   📈 Trades: ${trades} | Period: ${new Date(k.t as number).toISOString()} -> ${new Date(k.T as number).toISOString()}`);
          console.log('');
        }

        // ========== 4. TICKER 24H - Estadísticas completas ==========
        else if (streamName.includes('@ticker') && !streamName.includes('book')) {
          const lastPrice = parseFloat(data.c as string);
          const priceChange = parseFloat(data.p as string);
          const priceChangePercent = parseFloat(data.P as string);
          const weightedAvgPrice = parseFloat(data.w as string);
          const lastQty = parseFloat(data.Q as string);
          const openPrice = parseFloat(data.o as string);
          const highPrice = parseFloat(data.h as string);
          const lowPrice = parseFloat(data.l as string);
          const baseVolume = parseFloat(data.v as string);
          const quoteVolume = parseFloat(data.q as string);
          const openTime = new Date(data.O as number).toISOString();
          const closeTime = new Date(data.C as number).toISOString();
          const totalTrades = data.n as number;

          const directionEmoji = priceChangePercent >= 0 ? '🟢' : '🔴';
          
          console.log(`📊 [TICKER 24H] ${timestamp}`);
          console.log(`   ${directionEmoji} Price: ${lastPrice.toFixed(2)} | Change: ${priceChange.toFixed(2)} (${priceChangePercent.toFixed(2)}%)`);
          console.log(`   📈 High: ${highPrice.toFixed(2)} | 📉 Low: ${lowPrice.toFixed(2)} | Open: ${openPrice.toFixed(2)}`);
          console.log(`   💎 Weighted Avg: ${weightedAvgPrice.toFixed(2)} | Last Qty: ${lastQty.toFixed(6)}`);
          console.log(`   📊 Volume 24h: ${baseVolume.toFixed(4)} ${symbol.replace('USDT', '')} | Quote: $${quoteVolume.toFixed(2)}`);
          console.log(`   🔄 Trades 24h: ${totalTrades.toLocaleString()}`);
          console.log(`   ⏰ Window: ${openTime} -> ${closeTime}`);
          console.log('');
        }

        // ========== 5. BOOK TICKER - Best Bid/Ask ==========
        else if (streamName.includes('@bookTicker')) {
          const bestBid = parseFloat(data.b as string);
          const bestBidQty = parseFloat(data.B as string);
          const bestAsk = parseFloat(data.a as string);
          const bestAskQty = parseFloat(data.A as string);
          const updateId = data.u as number;

          const spread = bestAsk - bestBid;
          const spreadPercent = ((spread / bestBid) * 100).toFixed(4);
          const midPrice = (bestBid + bestAsk) / 2;
          const imbalance = (bestBidQty - bestAskQty) / (bestBidQty + bestAskQty);
          
          lastSpread = spread;
          lastImbalance = imbalance;

          const imbalanceEmoji = imbalance > 0.1 ? '🟢' : imbalance < -0.1 ? '🔴' : '⚪';

          console.log(`📖 [BOOK TICKER] ${timestamp}`);
          console.log(`   🟢 Best Bid: ${bestBid.toFixed(2)} x ${bestBidQty.toFixed(6)}`);
          console.log(`   🔴 Best Ask: ${bestAsk.toFixed(2)} x ${bestAskQty.toFixed(6)}`);
          console.log(`   💫 Mid Price: ${midPrice.toFixed(2)} | Spread: ${spread.toFixed(2)} (${spreadPercent}%)`);
          console.log(`   ${imbalanceEmoji} Imbalance: ${(imbalance * 100).toFixed(2)}% ${imbalance > 0 ? '(más bids)' : imbalance < 0 ? '(más asks)' : '(equilibrado)'}`);
          console.log(`   🔢 Update ID: ${updateId}`);
          console.log('');
        }

        // ========== 6. DEPTH - Order Book Top 5 ==========
        else if (streamName.includes('@depth')) {
          const bids = data.b as [string, string][];
          const asks = data.a as [string, string][];
          const lastUpdateId = data.u as number;

          console.log(`📚 [ORDER BOOK DEPTH] ${timestamp}`);
          console.log(`   Update ID: ${lastUpdateId}`);
          
          // Calcular totales
          let bidTotal = 0;
          let askTotal = 0;
          
          console.log(`   🟢 BIDS (Top 5):`);
          bids.slice(0, 5).forEach((bid, idx) => {
            const price = parseFloat(bid[0]);
            const qty = parseFloat(bid[1]);
            bidTotal += qty;
            console.log(`      ${idx + 1}. ${price.toFixed(2)} x ${qty.toFixed(6)} = $${(price * qty).toFixed(2)}`);
          });
          
          console.log(`   🔴 ASKS (Top 5):`);
          asks.slice(0, 5).forEach((ask, idx) => {
            const price = parseFloat(ask[0]);
            const qty = parseFloat(ask[1]);
            askTotal += qty;
            console.log(`      ${idx + 1}. ${price.toFixed(2)} x ${qty.toFixed(6)} = $${(price * qty).toFixed(2)}`);
          });

          const depthImbalance = (bidTotal - askTotal) / (bidTotal + askTotal);
          const depthEmoji = depthImbalance > 0.1 ? '🟢' : depthImbalance < -0.1 ? '🔴' : '⚪';
          
          console.log(`   ${depthEmoji} Depth Imbalance: ${(depthImbalance * 100).toFixed(2)}% (Bid: ${bidTotal.toFixed(4)} / Ask: ${askTotal.toFixed(4)})`);
          console.log('');
        }

        // ========== 7. FORCE ORDER - Liquidaciones ==========
        else if (streamName.includes('@forceOrder')) {
          liquidationCount++;
          const order = data.o;
          const side = order.S as string;
          const orderType = order.o as string;
          const timeInForce = order.f as string;
          const origQty = parseFloat(order.q as string);
          const price = parseFloat(order.p as string);
          const avgPrice = parseFloat(order.ap as string);
          const orderStatus = order.X as string;
          const lastFilledQty = parseFloat(order.l as string);
          const filledQty = parseFloat(order.z as string);
          const tradeTime = new Date(order.T as number).toISOString();

          const sideEmoji = side === 'BUY' ? '🟢' : '🔴';
          const value = avgPrice * filledQty;

          console.log(`⚠️  [LIQUIDATION ${liquidationCount}] ${timestamp}`);
          console.log(`   ${sideEmoji} Side: ${side} | Type: ${orderType} | Status: ${orderStatus}`);
          console.log(`   💰 Price: ${price.toFixed(2)} | Avg Price: ${avgPrice.toFixed(2)}`);
          console.log(`   📊 Qty: ${origQty.toFixed(6)} | Filled: ${filledQty.toFixed(6)} | Last Fill: ${lastFilledQty.toFixed(6)}`);
          console.log(`   💵 Value: $${value.toFixed(2)}`);
          console.log(`   ⏰ Trade Time: ${tradeTime} | TIF: ${timeInForce}`);
          console.log('');
        }
      }
    });

    // Mostrar resumen cada 30 segundos
    setInterval(() => {
      console.log('\n' + '='.repeat(80));
      console.log(`📊 RESUMEN - ${new Date().toISOString()}`);
      console.log('='.repeat(80));
      console.log(`💹 Precio Actual: ${lastPrice.toFixed(2)}`);
      console.log(`💰 Mark Price: ${lastMarkPrice.toFixed(2)} | Index: ${lastIndexPrice.toFixed(2)}`);
      console.log(`💸 Funding Rate: ${(lastFundingRate * 100).toFixed(4)}%`);
      console.log(`📈 Trades: ${aggTradeCount} | Buy Volume: $${buyVolume.toFixed(2)} | Sell Volume: $${sellVolume.toFixed(2)}`);
      console.log(`🔥 Buy/Sell Ratio: ${(buyVolume / (sellVolume || 1)).toFixed(2)}`);
      console.log(`📖 Spread: ${lastSpread.toFixed(2)} | Book Imbalance: ${(lastImbalance * 100).toFixed(2)}%`);
      console.log(`⚠️  Liquidaciones: ${liquidationCount}`);
      console.log('='.repeat(80) + '\n');
    }, 30000);

    break;
  }
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
