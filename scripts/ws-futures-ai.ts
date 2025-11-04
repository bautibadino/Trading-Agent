#!/usr/bin/env node

/**
 * WebSocket Listener para Binance FUTURES con TODOS los datos para IA
 * 
 * Streams incluidos:
 * - aggTrade: Trades agregados con lado comprador/vendedor
 * - markPrice@1s: Mark Price, Index Price, Funding Rate  
 * - kline: Velas OHLCV con volumen taker
 * - ticker: Ticker 24h completo con estadísticas
 * - bookTicker: Mejor Bid/Ask en tiempo real
 * - depth5@100ms: Top 5 niveles del libro de órdenes
 * - forceOrder: Liquidaciones
 */

import WebSocket from 'ws';
import chalk from 'chalk';
import { RSI, SMA, EMA } from 'trading-signals';
import axios from 'axios';
import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface CliOptions {
  symbol?: string;
  interval?: string;
  timeout?: number;
}

// Mapeo de intervalos a milisegundos
const INTERVAL_MS: Record<string, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '4h': 14_400_000
};

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
      default:
        break;
    }

    return acc;
  }, {});
};

const options = parseArgs();
const symbol = (options.symbol ?? 'BTCUSDT').toUpperCase();
const interval = options.interval ?? '1m';
const timeout = options.timeout ?? 20_000;

// Validar intervalo
if (!INTERVAL_MS[interval]) {
  console.error(chalk.red(`❌ Intervalo inválido: ${interval}`));
  console.log(chalk.yellow('Intervalos válidos: 1m, 5m, 15m, 30m, 1h, 4h'));
  process.exit(1);
}

// Configurar archivo de log organizado por timeframe
// Estructura: logs/1m/market-data-BTCUSDT-2025-11-04.jsonl
const logsDir = join(process.cwd(), 'logs', interval);
if (!existsSync(logsDir)) {
  mkdirSync(logsDir, { recursive: true });
}

// Nombre del archivo: market-data-SYMBOL-YYYY-MM-DD.jsonl
const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
const logFileName = `market-data-${symbol}-${today}.jsonl`;
const logFilePath = join(logsDir, logFileName);

console.log(chalk.blue.bold('\n🤖 MODO AI-DATA JSON - Binance FUTURES'));
console.log(chalk.blue('━'.repeat(80)));
console.log(chalk.cyan(`📡 Símbolo: ${symbol}`));
console.log(chalk.cyan(`⏱️  Intervalo Kline: ${interval}`));
console.log(chalk.cyan(`⏰ Timeout: ${timeout}ms`));
console.log(chalk.cyan(`💾 Archivo de log: logs/${interval}/${logFileName}`));
console.log(chalk.blue('━'.repeat(80)));
console.log(chalk.yellow('\n📊 Streams activos:'));
console.log(chalk.gray('   • aggTrade       → Trades agregados con lado comprador/vendedor'));
console.log(chalk.gray('   • markPrice@1s   → Mark Price, Index Price, Funding Rate'));
console.log(chalk.gray(`   • kline_${interval}      → Velas OHLCV con volumen taker + actualización de indicadores`));
console.log(chalk.gray('   • ticker         → Ticker 24h completo con estadísticas'));
console.log(chalk.gray('   • bookTicker     → Mejor Bid/Ask en tiempo real'));
console.log(chalk.gray('   • depth5@100ms   → Top 5 niveles del libro de órdenes'));
console.log(chalk.gray('   • forceOrder     → Liquidaciones (cuando ocurren)'));
console.log(chalk.blue('━'.repeat(80)));
console.log(chalk.magenta.bold('\n📈 INDICADORES TÉCNICOS:'));
console.log(chalk.gray('   • RSI(14), SMA(20), EMA(9), EMA(21)'));
console.log(chalk.blue('━'.repeat(80)));
const emissionIntervalSeconds = INTERVAL_MS[interval] / 1000;
console.log(chalk.green.bold(`\n✅ JSON completo emitido cada ${interval} (${emissionIntervalSeconds}s)`));
console.log(chalk.gray('   Los indicadores se inicializarán automáticamente con datos históricos'));
console.log(chalk.blue('━'.repeat(80) + '\n'));

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

// Binance FUTURES WebSocket URL
const wsUrl = `wss://fstream.binance.com/stream?streams=${streams.join('/')}`;

console.log(chalk.cyan(`🔗 Conectando a: ${wsUrl}\n`));

// Acumuladores para estadísticas
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
let lastBestBid = 0;
let lastBestAsk = 0;
let lastBestBidQty = 0;
let lastBestAskQty = 0;
let lastDepthImbalance = 0;
let last24hChange = 0;
let last24hVolume = 0;
let last24hHigh = 0;
let last24hLow = 0;
let last24hOpen = 0;
let tradesPerMinute = 0;
let largeTradesCount = 0; // Trades > $10k
let periodLiquidationVolume = 0; // Volumen de liquidaciones en el período actual

// Control de visualización
const SHOW_BOOK_TICKER = false; // Muy verboso, solo acumular
const SHOW_DEPTH = false; // Muy verboso, solo acumular
const MIN_TRADE_TO_SHOW = 5000; // Solo mostrar trades > $5k
const MIN_LIQUIDATION_TO_SHOW = 1000; // Solo mostrar liquidaciones > $1k

// Indicadores técnicos (simplificados)
const rsi14 = new RSI(14);
const sma20 = new SMA(20);
const ema9 = new EMA(9);
const ema21 = new EMA(21);

// Historial de velas para indicadores
interface CandleData {
  openTime: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}
const candleHistory: CandleData[] = [];
const MAX_CANDLE_HISTORY = 100; // Mantener últimas 100 velas

// Historial de precios para calcular volatilidad
const priceHistory: number[] = [];
const MAX_PRICE_HISTORY = 20;

// Variables para micro flow del último minuto
let lastMinuteTakerBuyQuote = 0;
let lastMinuteTakerSellQuote = 0;

// Función para calcular volatilidad (desviación estándar de retornos)
function calculateVolatility(prices: number[]): number | null {
  if (prices.length < 2) return null;
  
  // Calcular retornos logarítmicos
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const ret = Math.log(prices[i] / prices[i - 1]);
    returns.push(ret);
  }
  
  // Calcular media de retornos
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  
  // Calcular desviación estándar
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  
  // Convertir a porcentaje
  return stdDev;
}

// Función para inicializar indicadores con datos históricos
async function initializeIndicators() {
  try {
    console.log(chalk.yellow('📥 Obteniendo datos históricos para inicializar indicadores...'));
    
    // Obtener últimas 100 velas de 1m de Binance Futures
    const response = await axios.get(
      `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=100`
    );
    const klines = response.data;
    
    console.log(chalk.green(`✅ Obtenidas ${klines.length} velas históricas`));
    
    // Actualizar indicadores con datos históricos
    for (const kline of klines) {
      const close = parseFloat(kline[4]);
      const high = parseFloat(kline[2]);
      const low = parseFloat(kline[3]);
      
      // Agregar al historial de precios para volatilidad
      priceHistory.push(close);
      if (priceHistory.length > MAX_PRICE_HISTORY) {
        priceHistory.shift();
      }
      
      try {
        rsi14.update(close, false);
        sma20.update(close, false);
        ema9.update(close, false);
        ema21.update(close, false);
      } catch (e) { /* ignore */ }
    }
    
    console.log(chalk.green.bold('✅ Indicadores inicializados'));
    console.log(chalk.cyan(`   RSI(14): ${rsi14.isStable ? '✓' : '✗'}`));
    console.log(chalk.cyan(`   SMA(20): ${sma20.isStable ? '✓' : '✗'}`));
    console.log(chalk.cyan(`   EMA(9): ${ema9.isStable ? '✓' : '✗'}`));
    console.log(chalk.cyan(`   EMA(21): ${ema21.isStable ? '✓' : '✗'}`));
    console.log('');
    
  } catch (error) {
    console.log(chalk.red(`⚠️  Error inicializando indicadores: ${(error as Error).message}`));
    console.log(chalk.yellow('   Continuando sin inicialización (los indicadores se estabilizarán con el tiempo)'));
  }
}

const ws = new WebSocket(wsUrl, {
  handshakeTimeout: timeout,
  perMessageDeflate: false
});

ws.on('open', async () => {
  console.log(chalk.green.bold('✅ Conectado a Binance Futures WebSocket\n'));
  
  // Inicializar indicadores con datos históricos
  await initializeIndicators();
});

ws.on('message', (raw: Buffer) => {
  try {
    const envelope = JSON.parse(raw.toString());
    const streamName = envelope.stream as string;
    const data = envelope.data;
    const timestamp = new Date().toISOString();

    // ========== 1. AGG TRADE - Trades agregados ==========
    if (streamName.includes('@aggTrade')) {
      aggTradeCount++;
      tradesPerMinute++;
      const isBuyerMaker = data.m as boolean;
      const price = parseFloat(data.p as string);
      const qty = parseFloat(data.q as string);
      const volume = price * qty;
      
      lastPrice = price;
      
      if (isBuyerMaker) {
        // Buyer es maker = alguien vendió agresivamente
        sellVolume += volume;
        lastMinuteTakerSellQuote += volume;
      } else {
        // Buyer es taker = alguien compró agresivamente
        buyVolume += volume;
        lastMinuteTakerBuyQuote += volume;
      }

      // Solo mostrar trades grandes
      if (volume >= MIN_TRADE_TO_SHOW) {
        largeTradesCount++;
        const side = isBuyerMaker ? 'SELL' : 'BUY';
        const sideColor = isBuyerMaker ? chalk.red : chalk.green;
        const sideEmoji = isBuyerMaker ? '🔴' : '🟢';
        
        console.log(sideColor.bold(`${sideEmoji} [TRADE GRANDE] ${timestamp}`));
        console.log(chalk.white(`   Price: ${price.toFixed(2)} | Qty: ${qty.toFixed(6)} | Volume: $${volume.toLocaleString()}`));
        console.log(chalk.gray(`   Side: ${side} (taker) | Trade ID: ${data.a}`));
        console.log('');
      }
    }

    // ========== 2. MARK PRICE - Funding & Basis ==========
    else if (streamName.includes('@markPrice')) {
      const markPrice = parseFloat(data.p as string);
      const indexPrice = parseFloat(data.i as string);
      const fundingRate = parseFloat(data.r as string);

      lastMarkPrice = markPrice;
      lastIndexPrice = indexPrice;
      lastFundingRate = fundingRate;
      
      // Solo acumular, no mostrar (se muestra en resumen cada minuto)
    }

    // ========== 3. KLINE - Velas OHLCV ==========
    else if (streamName.includes('@kline')) {
      const k = data.k;
      const isClosed = k.x as boolean;
      
      // Solo mostrar cuando se cierra la vela
      if (isClosed) {
        const openTime = k.t as number;
        const open = parseFloat(k.o as string);
        const high = parseFloat(k.h as string);
        const low = parseFloat(k.l as string);
        const close = parseFloat(k.c as string);
        const volume = parseFloat(k.v as string);
        const quoteVolume = parseFloat(k.q as string);
        const takerBuyBaseVol = parseFloat(k.V as string);
        const takerBuyQuoteVol = parseFloat(k.Q as string);
        const trades = k.n as number;

        // Agregar vela al historial
        candleHistory.push({
          openTime,
          close,
          high,
          low,
          volume: quoteVolume
        });
        
        // Mantener solo las últimas MAX_CANDLE_HISTORY velas
        if (candleHistory.length > MAX_CANDLE_HISTORY) {
          candleHistory.shift();
        }

        // Agregar precio al historial para volatilidad
        priceHistory.push(close);
        if (priceHistory.length > MAX_PRICE_HISTORY) {
          priceHistory.shift();
        }

        // Actualizar indicadores
        try {
          rsi14.update(close, false);
          sma20.update(close, false);
          ema9.update(close, false);
          ema21.update(close, false);
        } catch (error) {
          // Ignorar errores de indicadores sin suficientes datos
        }

        const change = close - open;
        const changePercent = ((change / open) * 100).toFixed(2);
        const takerBuyPercent = ((takerBuyBaseVol / volume) * 100).toFixed(2);
        
        const directionColor = change >= 0 ? chalk.green : chalk.red;
        const directionEmoji = change >= 0 ? '🟢' : '🔴';

        console.log(chalk.blue.bold(`🕯️  [KLINE ${k.i} CERRADA] ${timestamp}`));
        console.log(chalk.white(`   OHLC: O:${open.toFixed(2)} H:${high.toFixed(2)} L:${low.toFixed(2)} C:${close.toFixed(2)}`));
        console.log(directionColor(`   ${directionEmoji} Change: ${change.toFixed(2)} (${changePercent}%)`));
        console.log(chalk.cyan(`   📊 Volume: ${volume.toFixed(4)} ${symbol.replace('USDT', '')} | Quote: $${quoteVolume.toLocaleString()}`));
        console.log(chalk.yellow(`   🔥 Taker Buy: ${takerBuyBaseVol.toFixed(4)} (${takerBuyPercent}%) | Trades: ${trades}`));
        console.log('');
      }
    }

    // ========== 4. TICKER 24H - Estadísticas completas ==========
    else if (streamName.includes('@ticker') && !streamName.includes('book')) {
      const priceChangePercent = parseFloat(data.P as string);
      const quoteVolume = parseFloat(data.q as string);
      const high = parseFloat(data.h as string);
      const low = parseFloat(data.l as string);
      const open = parseFloat(data.o as string);

      last24hChange = priceChangePercent;
      last24hVolume = quoteVolume;
      last24hHigh = high;
      last24hLow = low;
      last24hOpen = open;
      
      // Solo acumular, no mostrar (se muestra en resumen cada minuto)
    }

    // ========== 5. BOOK TICKER - Best Bid/Ask ==========
    else if (streamName.includes('@bookTicker')) {
      const bestBid = parseFloat(data.b as string);
      const bestBidQty = parseFloat(data.B as string);
      const bestAsk = parseFloat(data.a as string);
      const bestAskQty = parseFloat(data.A as string);

      lastBestBid = bestBid;
      lastBestAsk = bestAsk;
      lastBestBidQty = bestBidQty;
      lastBestAskQty = bestAskQty;

      const spread = bestAsk - bestBid;
      const imbalance = (bestBidQty - bestAskQty) / (bestBidQty + bestAskQty);
      
      lastSpread = spread;
      lastImbalance = imbalance;
      
      // No mostrar (se actualiza cientos de veces por segundo)
    }

    // ========== 6. DEPTH - Order Book Top 5 ==========
    else if (streamName.includes('@depth')) {
      const bids = data.b as [string, string][];
      const asks = data.a as [string, string][];
      
      // Calcular totales para el imbalance
      let bidTotal = 0;
      let askTotal = 0;
      
      bids.slice(0, 5).forEach((bid) => {
        bidTotal += parseFloat(bid[1]);
      });
      
      asks.slice(0, 5).forEach((ask) => {
        askTotal += parseFloat(ask[1]);
      });

      const depthImbalance = (bidTotal - askTotal) / (bidTotal + askTotal);
      lastDepthImbalance = depthImbalance;
      
      // No mostrar (se actualiza muy frecuentemente)
    }

    // ========== 7. FORCE ORDER - Liquidaciones ==========
    else if (streamName.includes('@forceOrder')) {
      liquidationCount++;
      const order = data.o;
      const side = order.S as string;
      const avgPrice = parseFloat(order.ap as string);
      const filledQty = parseFloat(order.z as string);
      const value = avgPrice * filledQty;
      
      // Acumular volumen de liquidaciones
      periodLiquidationVolume += value;

      // Solo mostrar liquidaciones importantes
      if (value >= MIN_LIQUIDATION_TO_SHOW) {
        const sideColor = side === 'BUY' ? chalk.green : chalk.red;
        const orderStatus = order.X as string;

        console.log(chalk.red.bold(`⚠️  [LIQUIDACION] ${timestamp}`));
        console.log(sideColor(`   Side: ${side} | Status: ${orderStatus}`));
        console.log(chalk.yellow(`   💰 Avg Price: ${avgPrice.toFixed(2)}`));
        console.log(chalk.white(`   📊 Qty: ${filledQty.toFixed(6)}`));
        console.log(chalk.magenta(`   💵 Value: $${value.toLocaleString()}`));
        console.log('');
      }
    }

  } catch (error) {
    console.error(chalk.red(`❌ Error parseando mensaje: ${(error as Error).message}`));
  }
});

ws.on('error', (error) => {
  console.error(chalk.red.bold(`❌ WebSocket Error: ${error.message}`));
});

ws.on('close', (code, reason) => {
  console.log(chalk.yellow(`\n🔌 Conexión cerrada: ${code} - ${reason.toString()}`));
  process.exit(0);
});

// Generar y emitir JSON cada 60 segundos
setInterval(() => {
  const timestamp = new Date().toISOString();
  
  // Calcular valores
  const midPrice = (lastBestBid + lastBestAsk) / 2;
  const spreadBps = lastBestBid > 0 ? (lastSpread / lastBestBid) * 10000 : 0;
  
  // Microprice: precio ponderado por cantidades del libro
  const totalQty = lastBestBidQty + lastBestAskQty;
  const microprice = totalQty > 0
    ? (lastBestBid * lastBestAskQty + lastBestAsk * lastBestBidQty) / totalQty
    : midPrice;
  
  // Taker buy ratio
  const totalTakerQuote = lastMinuteTakerBuyQuote + lastMinuteTakerSellQuote;
  const takerBuyRatio = totalTakerQuote > 0 ? lastMinuteTakerBuyQuote / totalTakerQuote : 0;
  
  // Obtener valores de indicadores (con null checks)
  let rsi14Value: number | null = null;
  let sma20Value: number | null = null;
  let ema9Value: number | null = null;
  let ema21Value: number | null = null;

  try {
    if (rsi14.isStable) {
      rsi14Value = parseFloat(rsi14.getResult()!.valueOf().toFixed(2));
    }
  } catch (e) { /* ignore */ }

  try {
    if (sma20.isStable) {
      sma20Value = parseFloat(sma20.getResult()!.valueOf().toFixed(2));
    }
  } catch (e) { /* ignore */ }

  try {
    if (ema9.isStable) {
      ema9Value = parseFloat(ema9.getResult()!.valueOf().toFixed(2));
    }
  } catch (e) { /* ignore */ }

  try {
    if (ema21.isStable) {
      ema21Value = parseFloat(ema21.getResult()!.valueOf().toFixed(2));
    }
  } catch (e) { /* ignore */ }
  
  // Calcular volatilidad
  const volatility = calculateVolatility(priceHistory);
  const volatilityPercent = volatility ? parseFloat((volatility * 100).toFixed(2)) : null;
  
  // Heurísticas
  const ema9Above21 = ema9Value && ema21Value ? ema9Value > ema21Value : null;
  let rsiState = 'neutral';
  if (rsi14Value !== null) {
    if (rsi14Value > 70) rsiState = 'overbought';
    else if (rsi14Value < 30) rsiState = 'oversold';
  }
  const buyPressure = takerBuyRatio > 0.55;
  
  // Construir JSON
  const marketData = {
    ts: timestamp,
    symbol,
    lastPrice: parseFloat(lastPrice.toFixed(2)),
    orderbook: {
      bestBid: { p: parseFloat(lastBestBid.toFixed(2)), q: parseFloat(lastBestBidQty.toFixed(2)) },
      bestAsk: { p: parseFloat(lastBestAsk.toFixed(2)), q: parseFloat(lastBestAskQty.toFixed(2)) },
      mid: parseFloat(midPrice.toFixed(2)),
      spread: parseFloat(lastSpread.toFixed(2)),
      spreadBps: parseFloat(spreadBps.toFixed(2)),
      imbalance: parseFloat(lastImbalance.toFixed(2)),
      microprice: parseFloat(microprice.toFixed(2))
    },
    micro_flow: {
      takerBuyQuote: parseFloat(lastMinuteTakerBuyQuote.toFixed(2)),
      takerSellQuote: parseFloat(lastMinuteTakerSellQuote.toFixed(2)),
      takerBuyRatio: parseFloat(takerBuyRatio.toFixed(2))
    },
    indicators: {
      rsi14: rsi14Value,
      sma20: sma20Value,
      ema9: ema9Value,
      ema21: ema21Value,
      volatility: volatilityPercent
    },
    heuristics: {
      ema9Above21,
      rsiState,
      buyPressure
    },
    market_stats: {
      fundingRate: parseFloat(lastFundingRate.toFixed(6)),
      indexPrice: parseFloat(lastIndexPrice.toFixed(2)),
      volume24h: parseFloat(last24hVolume.toFixed(2)),
      high24h: parseFloat(last24hHigh.toFixed(2)),
      low24h: parseFloat(last24hLow.toFixed(2)),
      openInterest: null, // Requiere stream adicional
      liquidationVolume: parseFloat(periodLiquidationVolume.toFixed(2))
    }
  };
  
  // Emitir JSON a consola
  console.log(JSON.stringify(marketData, null, 2));
  console.log(''); // Línea en blanco para separación
  
  // Guardar JSON en archivo (formato JSONL - una línea por JSON)
  try {
    appendFileSync(logFilePath, JSON.stringify(marketData) + '\n', 'utf-8');
    console.log(chalk.gray(`💾 Guardado en: ${logFileName}`));
    console.log('');
  } catch (error) {
    console.error(chalk.red(`❌ Error guardando log: ${(error as Error).message}`));
  }
  
  // Reiniciar contadores del período
  lastMinuteTakerBuyQuote = 0;
  lastMinuteTakerSellQuote = 0;
  tradesPerMinute = 0;
  periodLiquidationVolume = 0;
}, INTERVAL_MS[interval]);

// Manejo de señales de cierre
const shutdown = () => {
  console.log(chalk.yellow('\n🛑 Cerrando conexión...'));
  ws.close();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

