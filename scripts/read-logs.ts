#!/usr/bin/env node

/**
 * Utilidad para leer y analizar logs de market data
 * 
 * Uso:
 *   npm run logs -- --timeframe=5m --symbol=BTCUSDT
 *   npm run logs -- --timeframe=1h --symbol=ETHUSDT --last=10
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

interface CliOptions {
  timeframe?: string;
  symbol?: string;
  date?: string;
  last?: number;
  stats?: boolean;
}

interface MarketData {
  ts: string;
  symbol: string;
  lastPrice: number;
  orderbook: {
    bestBid: { p: number; q: number };
    bestAsk: { p: number; q: number };
    mid: number;
    spread: number;
    spreadBps: number;
    imbalance: number;
    microprice: number;
  };
  micro_flow: {
    takerBuyQuote: number;
    takerSellQuote: number;
    takerBuyRatio: number;
  };
  indicators: {
    rsi14: number | null;
    sma20: number | null;
    ema9: number | null;
    ema21: number | null;
    volatility: number | null;
  };
  heuristics: {
    ema9Above21: boolean | null;
    rsiState: string;
    buyPressure: boolean;
  };
  market_stats: {
    fundingRate: number;
    indexPrice: number;
    volume24h: number;
    high24h: number;
    low24h: number;
    openInterest: number | null;
    liquidationVolume: number;
  };
}

const parseArgs = (): CliOptions => {
  const args = process.argv.slice(2);
  return args.reduce<CliOptions>((acc, arg) => {
    const [rawKey, rawValue] = arg.replace(/^--/, '').split('=');
    if (!rawKey) return acc;

    const key = rawKey.toLowerCase();
    const value = rawValue ?? 'true';

    switch (key) {
      case 'timeframe':
        acc.timeframe = value;
        break;
      case 'symbol':
        acc.symbol = value.toUpperCase();
        break;
      case 'date':
        acc.date = value;
        break;
      case 'last': {
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) {
          acc.last = parsed;
        }
        break;
      }
      case 'stats':
        acc.stats = value !== 'false';
        break;
      default:
        break;
    }

    return acc;
  }, {});
};

function readMarketData(timeframe: string, symbol: string, date: string): MarketData[] {
  const logsDir = join(process.cwd(), 'logs', timeframe);
  const fileName = `market-data-${symbol}-${date}.jsonl`;
  const filePath = join(logsDir, fileName);

  if (!existsSync(filePath)) {
    console.error(chalk.red(`❌ Archivo no encontrado: ${filePath}`));
    console.log(chalk.yellow('\nArchivos disponibles:'));
    
    if (existsSync(logsDir)) {
      const files = readdirSync(logsDir);
      files.forEach(file => console.log(chalk.gray(`   - ${file}`)));
    } else {
      console.log(chalk.gray('   (ninguno)'));
    }
    
    process.exit(1);
  }

  const content = readFileSync(filePath, 'utf-8');
  return content
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

function calculateStats(data: MarketData[]) {
  const validRsi = data.filter(d => d.indicators.rsi14 !== null);
  const prices = data.map(d => d.lastPrice);
  
  const stats = {
    totalRecords: data.length,
    priceRange: {
      min: Math.min(...prices),
      max: Math.max(...prices),
      current: prices[prices.length - 1],
      change: prices[prices.length - 1] - prices[0],
      changePercent: ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100
    },
    rsi: validRsi.length > 0 ? {
      avg: validRsi.reduce((sum, d) => sum + d.indicators.rsi14!, 0) / validRsi.length,
      min: Math.min(...validRsi.map(d => d.indicators.rsi14!)),
      max: Math.max(...validRsi.map(d => d.indicators.rsi14!)),
      current: validRsi[validRsi.length - 1].indicators.rsi14
    } : null,
    flow: {
      avgBuyRatio: data.reduce((sum, d) => sum + d.micro_flow.takerBuyRatio, 0) / data.length,
      totalBuyVolume: data.reduce((sum, d) => sum + d.micro_flow.takerBuyQuote, 0),
      totalSellVolume: data.reduce((sum, d) => sum + d.micro_flow.takerSellQuote, 0)
    },
    spread: {
      avgBps: data.reduce((sum, d) => sum + d.orderbook.spreadBps, 0) / data.length,
      avgImbalance: data.reduce((sum, d) => sum + d.orderbook.imbalance, 0) / data.length
    },
    heuristics: {
      bullishPeriods: data.filter(d => d.heuristics.ema9Above21 === true).length,
      buyPressurePeriods: data.filter(d => d.heuristics.buyPressure).length,
      oversoldPeriods: data.filter(d => d.heuristics.rsiState === 'oversold').length,
      overboughtPeriods: data.filter(d => d.heuristics.rsiState === 'overbought').length
    }
  };

  return stats;
}

function printRecord(record: MarketData, index: number) {
  console.log(chalk.blue.bold(`\n📊 Registro #${index + 1} - ${record.ts}`));
  console.log(chalk.white(`   Símbolo: ${record.symbol} | Precio: $${record.lastPrice.toLocaleString()}`));
  
  console.log(chalk.cyan('\n   📖 Order Book:'));
  console.log(chalk.white(`      Bid: $${record.orderbook.bestBid.p} x ${record.orderbook.bestBid.q}`));
  console.log(chalk.white(`      Ask: $${record.orderbook.bestAsk.p} x ${record.orderbook.bestAsk.q}`));
  console.log(chalk.gray(`      Spread: ${record.orderbook.spreadBps.toFixed(2)} bps | Imbalance: ${(record.orderbook.imbalance * 100).toFixed(2)}%`));
  
  console.log(chalk.yellow('\n   🌊 Micro Flow:'));
  console.log(chalk.green(`      Buy: $${record.micro_flow.takerBuyQuote.toLocaleString()}`));
  console.log(chalk.red(`      Sell: $${record.micro_flow.takerSellQuote.toLocaleString()}`));
  console.log(chalk.white(`      Ratio: ${(record.micro_flow.takerBuyRatio * 100).toFixed(2)}%`));
  
  if (record.indicators.rsi14 !== null) {
    console.log(chalk.magenta('\n   📈 Indicadores:'));
    console.log(chalk.white(`      RSI(14): ${record.indicators.rsi14?.toFixed(2)}`));
    console.log(chalk.white(`      SMA(20): $${record.indicators.sma20?.toFixed(2)}`));
    console.log(chalk.white(`      EMA(9): $${record.indicators.ema9?.toFixed(2)} | EMA(21): $${record.indicators.ema21?.toFixed(2)}`));
    console.log(chalk.white(`      Volatility: ${record.indicators.volatility ? (record.indicators.volatility * 100).toFixed(2) + '%' : 'N/A'}`));
  }
  
  console.log(chalk.green('\n   🎯 Heurísticas:'));
  console.log(chalk.white(`      Tendencia: ${record.heuristics.ema9Above21 ? 'Alcista ↗' : 'Bajista ↘'}`));
  console.log(chalk.white(`      RSI Estado: ${record.heuristics.rsiState}`));
  console.log(chalk.white(`      Presión Compradora: ${record.heuristics.buyPressure ? 'Sí ✓' : 'No ✗'}`));
  
  console.log(chalk.yellow('\n   💹 Market Stats:'));
  console.log(chalk.white(`      Funding Rate: ${(record.market_stats.fundingRate * 100).toFixed(4)}%`));
  console.log(chalk.white(`      Index Price: $${record.market_stats.indexPrice.toLocaleString()}`));
  console.log(chalk.white(`      24h Range: $${record.market_stats.low24h.toLocaleString()} - $${record.market_stats.high24h.toLocaleString()}`));
  console.log(chalk.white(`      24h Volume: $${record.market_stats.volume24h.toLocaleString()}`));
  console.log(chalk.white(`      Liquidations: $${record.market_stats.liquidationVolume.toLocaleString()}`));
}

function printStats(stats: any, symbol: string, timeframe: string) {
  console.log(chalk.blue.bold('\n' + '='.repeat(80)));
  console.log(chalk.yellow.bold(`📊 ESTADÍSTICAS - ${symbol} (${timeframe})`));
  console.log(chalk.blue('='.repeat(80)));
  
  console.log(chalk.white.bold('\n💹 PRECIO:'));
  console.log(chalk.white(`   Total Registros: ${stats.totalRecords}`));
  console.log(chalk.white(`   Actual: $${stats.priceRange.current.toLocaleString()}`));
  console.log(chalk.white(`   Rango: $${stats.priceRange.min.toLocaleString()} - $${stats.priceRange.max.toLocaleString()}`));
  const changeColor = stats.priceRange.change >= 0 ? chalk.green : chalk.red;
  console.log(changeColor(`   Cambio: ${stats.priceRange.change >= 0 ? '+' : ''}$${stats.priceRange.change.toFixed(2)} (${stats.priceRange.changePercent.toFixed(2)}%)`));
  
  if (stats.rsi) {
    console.log(chalk.white.bold('\n📈 RSI(14):'));
    console.log(chalk.white(`   Actual: ${stats.rsi.current?.toFixed(2)}`));
    console.log(chalk.white(`   Promedio: ${stats.rsi.avg.toFixed(2)}`));
    console.log(chalk.white(`   Rango: ${stats.rsi.min.toFixed(2)} - ${stats.rsi.max.toFixed(2)}`));
  }
  
  console.log(chalk.white.bold('\n🌊 FLUJO:'));
  const buyRatioPercent = stats.flow.avgBuyRatio * 100;
  const flowColor = buyRatioPercent > 55 ? chalk.green : buyRatioPercent < 45 ? chalk.red : chalk.white;
  console.log(flowColor(`   Ratio Buy Promedio: ${buyRatioPercent.toFixed(2)}%`));
  console.log(chalk.green(`   Volumen Buy Total: $${stats.flow.totalBuyVolume.toLocaleString()}`));
  console.log(chalk.red(`   Volumen Sell Total: $${stats.flow.totalSellVolume.toLocaleString()}`));
  
  console.log(chalk.white.bold('\n📖 LIBRO:'));
  console.log(chalk.white(`   Spread Promedio: ${stats.spread.avgBps.toFixed(2)} bps`));
  console.log(chalk.white(`   Imbalance Promedio: ${(stats.spread.avgImbalance * 100).toFixed(2)}%`));
  
  console.log(chalk.white.bold('\n🎯 ANÁLISIS:'));
  console.log(chalk.white(`   Períodos Alcistas: ${stats.heuristics.bullishPeriods}/${stats.totalRecords} (${(stats.heuristics.bullishPeriods / stats.totalRecords * 100).toFixed(1)}%)`));
  console.log(chalk.white(`   Con Presión Compradora: ${stats.heuristics.buyPressurePeriods}/${stats.totalRecords} (${(stats.heuristics.buyPressurePeriods / stats.totalRecords * 100).toFixed(1)}%)`));
  console.log(chalk.white(`   Sobrevendido: ${stats.heuristics.oversoldPeriods} | Sobrecomprado: ${stats.heuristics.overboughtPeriods}`));
  
  console.log(chalk.blue('\n' + '='.repeat(80)));
}

// Main
const options = parseArgs();
const timeframe = options.timeframe ?? '1m';
const symbol = options.symbol ?? 'BTCUSDT';
const date = options.date ?? new Date().toISOString().split('T')[0];
const showStats = options.stats ?? false;
const lastN = options.last;

console.log(chalk.blue.bold('\n📖 LECTOR DE LOGS DE MARKET DATA'));
console.log(chalk.gray('━'.repeat(80)));
console.log(chalk.cyan(`Timeframe: ${timeframe} | Símbolo: ${symbol} | Fecha: ${date}`));
console.log(chalk.gray('━'.repeat(80)));

try {
  const data = readMarketData(timeframe, symbol, date);
  
  console.log(chalk.green(`\n✅ Archivo cargado: ${data.length} registros`));
  
  if (showStats) {
    const stats = calculateStats(data);
    printStats(stats, symbol, timeframe);
  } else if (lastN) {
    const records = data.slice(-lastN);
    console.log(chalk.yellow(`\n📋 Mostrando últimos ${records.length} registros:`));
    records.forEach((record, idx) => printRecord(record, idx));
  } else {
    // Mostrar solo el último registro por defecto
    console.log(chalk.yellow('\n📋 Último registro:'));
    printRecord(data[data.length - 1], data.length - 1);
    
    console.log(chalk.gray('\n💡 Tip: Usa --last=N para ver los últimos N registros o --stats para ver estadísticas'));
  }
  
} catch (error) {
  console.error(chalk.red(`\n❌ Error: ${(error as Error).message}`));
  process.exit(1);
}

