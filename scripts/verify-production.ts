#!/usr/bin/env node

import axios from 'axios';

const API_URL = process.argv[2] || 'http://localhost:8080';

async function verifyProduction() {
  console.log('🔍 Verificando API en producción...');
  console.log(`📡 URL: ${API_URL}\n`);

  try {
    // Test 1: Health check
    console.log('✅ Test 1: Health check...');
    const health = await axios.get(`${API_URL}/health`);
    console.log(`   ✓ Status: ${health.data.status}`);
    console.log(`   ✓ Uptime: ${Math.floor(health.data.uptime / 60)}m\n`);

    // Test 2: Collectors status
    console.log('✅ Test 2: Collectors status...');
    const collectors = await axios.get(`${API_URL}/api/collectors/status`);
    console.log(`   ✓ Collectors activos: ${collectors.data.collectors.length}`);
    collectors.data.collectors.forEach((c: any) => {
      console.log(`      - PID ${c.pid}: ${c.symbol} ${c.timeframe} (${c.status})`);
    });
    console.log('');

    // Test 3: Market data stats
    console.log('✅ Test 3: Market data stats...');
    const stats = await axios.get(`${API_URL}/api/logs/stats`);
    console.log(`   ✓ Total registros: ${stats.data.stats.total}`);
    console.log(`   ✓ Símbolos: ${stats.data.stats.symbols.length}`);
    console.log(`   ✓ Timeframes: ${stats.data.stats.timeframes.length}`);
    
    if (stats.data.stats.symbols.length > 0) {
      console.log('   Símbolos en BD:');
      stats.data.stats.symbols.forEach((s: any) => {
        console.log(`      - ${s.symbol}: ${s.count} registros`);
      });
    }
    console.log('');

    // Test 4: Latest market data
    if (stats.data.stats.total > 0) {
      console.log('✅ Test 4: Último market data...');
      const firstSymbol = stats.data.stats.symbols[0].symbol;
      const firstTimeframe = stats.data.stats.timeframes[0].timeframe;
      
      const latest = await axios.get(`${API_URL}/api/logs/latest`, {
        params: { symbol: firstSymbol, timeframe: firstTimeframe }
      });
      
      console.log(`   ✓ Symbol: ${latest.data.symbol}`);
      console.log(`   ✓ Timeframe: ${latest.data.timeframe}`);
      console.log(`   ✓ Last Price: $${latest.data.lastPrice}`);
      console.log(`   ✓ RSI: ${latest.data.rsi14 || 'N/A'}`);
      console.log(`   ✓ Timestamp: ${latest.data.timestamp}`);
      console.log('');
    }

    console.log('🎉 ¡Todos los tests pasaron!');
    console.log('✅ API funcionando correctamente en producción\n');

  } catch (error: any) {
    console.error('❌ Error en verificación:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, error.response.data);
    } else {
      console.error(`   ${error.message}`);
    }
    process.exit(1);
  }
}

verifyProduction();

