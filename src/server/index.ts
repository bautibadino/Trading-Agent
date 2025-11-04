#!/usr/bin/env node

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { join } from 'path';
import { CollectorDatabaseService } from './services/CollectorDatabaseService.js';
import { MarketDataService } from './services/MarketDataService.js';

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes - Market Data (reemplaza logs)
app.get('/api/logs', async (req: Request, res: Response) => {
  try {
    const { timeframe, symbol, startDate, endDate, limit, offset } = req.query;

    // Parsear fechas si existen
    let parsedStartDate: Date | undefined;
    let parsedEndDate: Date | undefined;
    
    if (startDate) {
      parsedStartDate = new Date(startDate as string);
    }
    
    if (endDate) {
      parsedEndDate = new Date(endDate as string);
    }

    // Obtener datos de Prisma
    const result = await MarketDataService.getMarketData({
      symbol: symbol ? (symbol as string).toUpperCase() : undefined,
      timeframe: timeframe as string | undefined,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      limit: limit ? parseInt(limit as string, 10) : 100,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });

    res.json({
      logs: result.data,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      timeframe: timeframe || 'all',
      symbol: symbol || 'all'
    });
  } catch (error) {
    console.error('Error obteniendo market data:', error);
    res.status(500).json({ 
      error: 'Error obteniendo datos de mercado', 
      message: (error as Error).message 
    });
  }
});

// Endpoint para obtener último dato de mercado por símbolo/timeframe
app.get('/api/logs/latest', async (req: Request, res: Response) => {
  try {
    const { symbol, timeframe } = req.query;

    if (!symbol || !timeframe) {
      return res.status(400).json({ 
        error: 'symbol y timeframe son requeridos' 
      });
    }

    const latest = await MarketDataService.getLatest(
      (symbol as string).toUpperCase(),
      timeframe as string
    );

    if (!latest) {
      return res.status(404).json({ 
        error: 'No se encontraron datos para ese símbolo/timeframe' 
      });
    }

    res.json(latest);
  } catch (error) {
    console.error('Error obteniendo último dato:', error);
    res.status(500).json({ 
      error: 'Error obteniendo último dato', 
      message: (error as Error).message 
    });
  }
});

// Endpoint para obtener estadísticas de market data
app.get('/api/logs/stats', async (req: Request, res: Response) => {
  try {
    const { symbol, timeframe } = req.query;

    const stats = await MarketDataService.getStats(
      symbol as string | undefined,
      timeframe as string | undefined
    );

    res.json({ stats });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ 
      error: 'Error obteniendo estadísticas', 
      message: (error as Error).message 
    });
  }
});

// Endpoint para iniciar collectors
app.post('/api/collectors/start', async (req: Request, res: Response) => {
  try {
    const { timeframe, symbol = 'ETHUSDT' } = req.body;
    
    if (!timeframe) {
      return res.status(400).json({ 
        error: 'timeframe es requerido (1m, 5m, 15m, 30m, 1h, 4h)' 
      });
    }

    const validTimeframes = ['1m', '5m', '15m', '30m', '1h', '4h'];
    if (!validTimeframes.includes(timeframe)) {
      return res.status(400).json({ 
        error: `Timeframe inválido. Debe ser uno de: ${validTimeframes.join(', ')}` 
      });
    }

    // Verificar si ya existe un collector para este símbolo y timeframe
    const existingCollectors = await CollectorDatabaseService.getCollectors();
    const alreadyRunning = existingCollectors.find(
      c => c.symbol === symbol && c.timeframe === timeframe && c.status === 'running'
    );

    if (alreadyRunning && CollectorDatabaseService.isPidAlive(alreadyRunning.pid)) {
      return res.status(409).json({ 
        error: `Ya existe un collector corriendo para ${symbol} en timeframe ${timeframe}`,
        pid: alreadyRunning.pid
      });
    }

    // Si el collector existe pero está muerto, limpiarlo
    if (alreadyRunning && !CollectorDatabaseService.isPidAlive(alreadyRunning.pid)) {
      await CollectorDatabaseService.stopCollector(alreadyRunning.pid);
    }

    // Iniciar proceso de collector
    const scriptPath = join(process.cwd(), 'dist/scripts/ws-futures-ai.js');
    const collectorProcess = spawn('node', [
      '--dns-result-order=ipv4first',
      scriptPath,
      `--symbol=${symbol}`,
      `--interval=${timeframe}`
    ], {
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,  // Pasar TODAS las variables de entorno (incluye DATABASE_URL)
        NODE_ENV: process.env.NODE_ENV || 'production'
      }
    });

    collectorProcess.unref();

    const pid = collectorProcess.pid;
    
    // Guardar estado del collector en la base de datos
    if (pid) {
      try {
        await CollectorDatabaseService.saveCollector({
          pid,
          timeframe,
          symbol,
          status: 'running',
          startedAt: new Date()
        });
        console.log(`✅ Collector guardado: PID ${pid}, ${symbol}, ${timeframe}`);
      } catch (dbError) {
        console.error('Error guardando collector en DB:', dbError);
        // Intentar detener el proceso si falla guardar en DB
        try {
          process.kill(pid, 'SIGTERM');
        } catch (killError) {
          console.error('Error deteniendo proceso:', killError);
        }
        throw dbError;
      }
    } else {
      throw new Error('No se pudo obtener el PID del proceso');
    }

    res.json({ 
      message: `Collector iniciado para ${symbol} en timeframe ${timeframe}`,
      pid
    });
  } catch (error) {
    console.error('Error starting collector:', error);
    res.status(500).json({ 
      error: 'Error iniciando collector', 
      message: (error as Error).message 
    });
  }
});

// Endpoint para obtener estado de collectors
app.get('/api/collectors/status', async (_req: Request, res: Response) => {
  try {
    // Obtener collectors con uptime y verificación de PIDs vivos
    const collectors = await CollectorDatabaseService.getCollectorsWithUptime();
    
    res.json({ collectors });
  } catch (error) {
    console.error('Error getting collectors status:', error);
    res.status(500).json({ 
      error: 'Error obteniendo estado de collectors', 
      message: (error as Error).message 
    });
  }
});

// Endpoint para limpiar collectors muertos
app.post('/api/collectors/cleanup', async (_req: Request, res: Response) => {
  try {
    const collectors = await CollectorDatabaseService.getCollectors();
    let cleaned = 0;
    
    for (const collector of collectors) {
      if (!CollectorDatabaseService.isPidAlive(collector.pid)) {
        await CollectorDatabaseService.stopCollector(collector.pid);
        cleaned++;
      }
    }

    res.json({ 
      message: `Limpieza completada: ${cleaned} collectors muertos marcados como stopped`,
      cleaned
    });
  } catch (error) {
    console.error('Error cleaning up collectors:', error);
    res.status(500).json({ 
      error: 'Error limpiando collectors', 
      message: (error as Error).message 
    });
  }
});

// Endpoint para detener un collector
app.post('/api/collectors/stop', async (req: Request, res: Response) => {
  try {
    const { pid } = req.body;
    
    if (!pid) {
      return res.status(400).json({ error: 'PID requerido' });
    }

    // Verificar que el PID sea un número
    const pidNum = parseInt(pid, 10);
    if (isNaN(pidNum)) {
      return res.status(400).json({ error: 'PID debe ser un número' });
    }

    // Verificar que el collector existe en la base de datos
    const exists = await CollectorDatabaseService.existsByPid(pidNum);
    
    if (!exists) {
      return res.status(404).json({ 
        error: 'Collector no encontrado en el registro',
        pid: pidNum
      });
    }

    // Verificar que el proceso existe
    if (!CollectorDatabaseService.isPidAlive(pidNum)) {
      await CollectorDatabaseService.stopCollector(pidNum);
      return res.status(404).json({ 
        error: 'Collector no encontrado o ya detenido',
        pid: pidNum
      });
    }

    try {
      // Intentar detener con SIGTERM (graceful shutdown)
      process.kill(pidNum, 'SIGTERM');
      
      // Actualizar estado en la base de datos
      await CollectorDatabaseService.stopCollector(pidNum);
      
      res.json({ 
        message: 'Collector detenido exitosamente',
        pid: pidNum
      });
    } catch (killError) {
      console.error(`Error deteniendo collector ${pidNum}:`, killError);
      res.status(500).json({ 
        error: `Error deteniendo collector: ${(killError as Error).message}`,
        pid: pidNum
      });
    }
  } catch (error) {
    console.error('Error stopping collector:', error);
    res.status(500).json({ 
      error: 'Error deteniendo collector', 
      message: (error as Error).message 
    });
  }
});

// Root endpoint con información
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Trading Bot Market Data API',
    version: '2.0.0',
    storage: 'PostgreSQL + Prisma Accelerate',
    endpoints: {
      health: '/health',
      marketData: {
        get: 'GET /api/logs?timeframe=1m&symbol=ETHUSDT&limit=100&offset=0',
        latest: 'GET /api/logs/latest?symbol=ETHUSDT&timeframe=1m',
        stats: 'GET /api/logs/stats?symbol=ETHUSDT&timeframe=1m'
      },
      collectors: {
        start: 'POST /api/collectors/start { "timeframe": "1m", "symbol": "ETHUSDT" }',
        status: 'GET /api/collectors/status',
        stop: 'POST /api/collectors/stop { "pid": 12345 }',
        cleanup: 'POST /api/collectors/cleanup (limpia collectors muertos)'
      }
    },
    docs: 'https://github.com/bautistabadino/trading-bot'
  });
});

// Limpiar collectors muertos al inicio del servidor
async function cleanupDeadCollectors() {
  try {
    const collectors = await CollectorDatabaseService.getCollectors();
    for (const collector of collectors) {
      if (!CollectorDatabaseService.isPidAlive(collector.pid)) {
        await CollectorDatabaseService.stopCollector(collector.pid);
        console.log(`🧹 Limpiado collector muerto: PID ${collector.pid}`);
      }
    }
  } catch (error) {
    console.error('Error limpiando collectors:', error);
  }
}

// Iniciar servidor
app.listen(PORT, async () => {
  console.log(`🚀 Servidor API corriendo en puerto ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Logs API: http://localhost:${PORT}/api/logs`);
  
  // Limpiar collectors muertos al iniciar
  await cleanupDeadCollectors();
  console.log('✅ Limpieza de collectors completada');
});
