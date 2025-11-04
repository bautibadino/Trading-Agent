#!/usr/bin/env node

import { MarketDataService } from '../src/server/services/MarketDataService.js';

async function testSaveMarketData() {
  console.log('🧪 Probando guardar market data en PostgreSQL...\n');

  const testData = {
    timestamp: new Date(),
    symbol: 'ETHUSDT',
    timeframe: '1m',
    lastPrice: 3500.50,
    orderbook: {
      bestBid: { p: 3500.00, q: 10.5 },
      bestAsk: { p: 3500.50, q: 8.3 },
      mid: 3500.25,
      spread: 0.50,
      spreadBps: 1.43,
      imbalance: 0.12,
      microprice: 3500.30
    },
    micro_flow: {
      takerBuyQuote: 100000,
      takerSellQuote: 80000,
      takerBuyRatio: 0.56
    },
    indicators: {
      rsi14: 55.5,
      sma20: 3490.20,
      ema9: 3495.10,
      ema21: 3488.50,
      volatility: 1.2
    },
    heuristics: {
      ema9Above21: true,
      rsiState: 'neutral',
      buyPressure: true
    },
    market_stats: {
      fundingRate: 0.0001,
      indexPrice: 3500.75,
      volume24h: 1000000000,
      high24h: 3550.00,
      low24h: 3450.00,
      openInterest: null,
      liquidationVolume: 50000
    }
  };

  try {
    console.log('📝 Datos de prueba preparados:');
    console.log(`   Symbol: ${testData.symbol}`);
    console.log(`   Timeframe: ${testData.timeframe}`);
    console.log(`   Last Price: $${testData.lastPrice}`);
    console.log('');

    console.log('💾 Intentando guardar en PostgreSQL...');
    await MarketDataService.saveMarketData(testData);
    
    console.log('✅ ¡Guardado exitoso!\n');

    console.log('🔍 Verificando que se guardó...');
    const latest = await MarketDataService.getLatest('ETHUSDT', '1m');
    
    if (latest) {
      console.log('✅ Dato recuperado de la BD:');
      console.log(`   ID: ${latest.id}`);
      console.log(`   Timestamp: ${latest.timestamp}`);
      console.log(`   Last Price: $${latest.lastPrice}`);
      console.log(`   RSI: ${latest.rsi14}`);
      console.log('');
      console.log('🎉 ¡Todo funciona correctamente!');
    } else {
      console.log('❌ No se pudo recuperar el dato');
    }

  } catch (error) {
    console.error('❌ ERROR al guardar:');
    console.error(error);
    process.exit(1);
  }
}

testSaveMarketData();

