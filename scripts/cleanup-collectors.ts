#!/usr/bin/env node

import { prisma } from '../src/config/prisma.js';

/**
 * Script para limpiar collectors que están marcados como running
 * pero sus procesos ya no existen
 */
async function cleanupCollectors() {
  try {
    console.log('🔍 Buscando collectors...');
    
    const collectors = await prisma.collector.findMany({
      where: {
        status: {
          in: ['running', 'error']
        }
      }
    });

    console.log(`📊 Encontrados ${collectors.length} collectors con estado running/error`);

    let cleaned = 0;
    
    for (const collector of collectors) {
      // Verificar si el proceso existe
      let isAlive = false;
      try {
        process.kill(collector.pid, 0);
        isAlive = true;
      } catch {
        isAlive = false;
      }

      if (!isAlive) {
        console.log(`❌ Collector muerto encontrado - PID: ${collector.pid}, Symbol: ${collector.symbol}, Timeframe: ${collector.timeframe}`);
        
        // Marcar como stopped
        await prisma.collector.update({
          where: { id: collector.id },
          data: {
            status: 'stopped',
            stoppedAt: new Date()
          }
        });
        
        cleaned++;
      } else {
        console.log(`✅ Collector vivo - PID: ${collector.pid}, Symbol: ${collector.symbol}, Timeframe: ${collector.timeframe}`);
      }
    }

    console.log(`\n🧹 Limpieza completada: ${cleaned} collectors marcados como stopped`);
    
    // Opcionalmente, eliminar collectors stopped muy antiguos (más de 7 días)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const deleted = await prisma.collector.deleteMany({
      where: {
        status: 'stopped',
        stoppedAt: {
          lt: sevenDaysAgo
        }
      }
    });

    console.log(`🗑️  Eliminados ${deleted.count} collectors antiguos (>7 días)`);
    
  } catch (error) {
    console.error('❌ Error limpiando collectors:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupCollectors();

