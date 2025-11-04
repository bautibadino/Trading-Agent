#!/usr/bin/env node

import { prisma } from '../src/config/prisma.js';

async function testConnection() {
  console.log('🔍 Probando conexión a Prisma Accelerate...\n');

  try {
    // Test 1: Verificar conexión
    console.log('✅ Test 1: Verificando conexión...');
    await prisma.$connect();
    console.log('   ✓ Conexión establecida correctamente\n');

    // Test 2: Contar collectors
    console.log('✅ Test 2: Contando collectors en la BD...');
    const collectorsCount = await prisma.collector.count();
    console.log(`   ✓ Total de collectors: ${collectorsCount}\n`);

    // Test 3: Obtener collectors activos
    console.log('✅ Test 3: Obteniendo collectors activos...');
    const activeCollectors = await prisma.collector.findMany({
      where: {
        status: 'running'
      },
      take: 5
    });
    console.log(`   ✓ Collectors activos: ${activeCollectors.length}`);
    if (activeCollectors.length > 0) {
      console.log('   Primeros collectors:');
      activeCollectors.forEach(c => {
        console.log(`     - PID ${c.pid}: ${c.symbol} ${c.timeframe} (${c.status})`);
      });
    }
    console.log();

    // Test 4: Contar market data
    console.log('✅ Test 4: Contando market data en la BD...');
    const marketDataCount = await prisma.marketData.count();
    console.log(`   ✓ Total de market data: ${marketDataCount}\n`);

    // Test 5: Contar trades
    console.log('✅ Test 5: Contando trades en la BD...');
    const tradesCount = await prisma.trade.count();
    console.log(`   ✓ Total de trades: ${tradesCount}\n`);

    // Test 6: Verificar latencia
    console.log('✅ Test 6: Midiendo latencia...');
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;
    console.log(`   ✓ Latencia: ${latency}ms\n`);

    console.log('🎉 ¡Todos los tests pasaron exitosamente!');
    console.log('📊 Prisma Accelerate está funcionando correctamente.\n');

  } catch (error) {
    console.error('❌ Error en los tests:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();

