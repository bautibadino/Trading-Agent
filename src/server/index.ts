#!/usr/bin/env node

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import { CollectorDatabaseService } from './services/CollectorDatabaseService.js';

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

// API Routes
app.get('/api/logs', async (req: Request, res: Response) => {
  try {
    const { timeframe, symbol, date, limit } = req.query;
    const logsDir = join(process.cwd(), 'logs');
    
    if (!existsSync(logsDir)) {
      return res.json({ logs: [], total: 0 });
    }

    // Si no especifica timeframe, listar todos los disponibles
    if (!timeframe) {
      const timeframes = await readdir(logsDir, { withFileTypes: true });
      const dirs = timeframes
        .filter(d => d.isDirectory())
        .map(d => d.name);
      
      return res.json({ 
        timeframes: dirs,
        message: 'Especifica ?timeframe=1m para obtener logs de un timeframe específico'
      });
    }

    const timeframeDir = join(logsDir, timeframe as string);
    if (!existsSync(timeframeDir)) {
      return res.status(404).json({ error: `Timeframe ${timeframe} no encontrado` });
    }

    // Listar archivos disponibles
    const files = await readdir(timeframeDir);
    let matchingFiles = files.filter(f => f.endsWith('.jsonl'));

    // Filtrar por símbolo si se especifica
    if (symbol) {
      matchingFiles = matchingFiles.filter(f => 
        f.includes(`-${(symbol as string).toUpperCase()}-`)
      );
    }

    // Filtrar por fecha si se especifica
    if (date) {
      matchingFiles = matchingFiles.filter(f => f.includes(date as string));
    }

    // Si no hay archivos, devolver vacío
    if (matchingFiles.length === 0) {
      return res.json({ logs: [], total: 0, files: [] });
    }

    // Leer el archivo más reciente si no se especifica fecha
    const fileToRead = date 
      ? matchingFiles.find(f => f.includes(date as string)) || matchingFiles[0]
      : matchingFiles.sort().reverse()[0]; // Más reciente

    const filePath = join(timeframeDir, fileToRead);
    const fileContent = await readFile(filePath, 'utf-8');
    const lines = fileContent.trim().split('\n').filter(l => l.trim());
    
    // Parsear logs
    let logs = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(l => l !== null);

    // Filtrar por símbolo en los datos si no se hizo en el nombre del archivo
    if (symbol && !date) {
      logs = logs.filter((log: any) => 
        log.symbol === (symbol as string).toUpperCase()
      );
    }

    // Aplicar límite
    const limitNum = limit ? parseInt(limit as string, 10) : 100;
    if (limitNum > 0) {
      logs = logs.slice(-limitNum); // Últimos N logs
    }

    res.json({
      logs,
      total: logs.length,
      file: fileToRead,
      timeframe,
      symbol: symbol || 'all'
    });
  } catch (error) {
    console.error('Error reading logs:', error);
    res.status(500).json({ 
      error: 'Error leyendo logs', 
      message: (error as Error).message 
    });
  }
});

// Endpoint para listar archivos disponibles
app.get('/api/logs/files', async (req: Request, res: Response) => {
  try {
    const { timeframe } = req.query;
    const logsDir = join(process.cwd(), 'logs');
    
    if (!existsSync(logsDir)) {
      return res.json({ files: [] });
    }

    if (!timeframe) {
      // Listar todos los timeframes con sus archivos
      const timeframes = await readdir(logsDir, { withFileTypes: true });
      const result: Record<string, any[]> = {};
      
      for (const tf of timeframes.filter(d => d.isDirectory())) {
        const tfDir = join(logsDir, tf.name);
        const files = await readdir(tfDir);
        const filesWithStats = await Promise.all(
          files.filter(f => f.endsWith('.jsonl')).map(async (f) => {
            const filePath = join(tfDir, f);
            const stats = await stat(filePath);
            return {
              name: f,
              size: stats.size,
              modified: stats.mtime.toISOString()
            };
          })
        );
        result[tf.name] = filesWithStats.sort((a, b) => 
          b.modified.localeCompare(a.modified)
        );
      }
      
      return res.json({ files: result });
    }

    const timeframeDir = join(logsDir, timeframe as string);
    if (!existsSync(timeframeDir)) {
      return res.status(404).json({ error: `Timeframe ${timeframe} no encontrado` });
    }

    const files = await readdir(timeframeDir);
    const filesWithStats = await Promise.all(
      files.filter(f => f.endsWith('.jsonl')).map(async (f) => {
        const filePath = join(timeframeDir, f);
        const stats = await stat(filePath);
        return {
          name: f,
          size: stats.size,
          modified: stats.mtime.toISOString()
        };
      })
    );

    res.json({
      timeframe,
      files: filesWithStats.sort((a, b) => b.modified.localeCompare(a.modified))
    });
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({ 
      error: 'Error listando archivos', 
      message: (error as Error).message 
    });
  }
});

// Endpoint para obtener estadísticas de logs
app.get('/api/logs/stats', async (req: Request, res: Response) => {
  try {
    const logsDir = join(process.cwd(), 'logs');
    
    if (!existsSync(logsDir)) {
      return res.json({ stats: {} });
    }

    const timeframes = await readdir(logsDir, { withFileTypes: true });
    const stats: Record<string, any> = {};
    
    for (const tf of timeframes.filter(d => d.isDirectory())) {
      const tfDir = join(logsDir, tf.name);
      const files = await readdir(tfDir);
      const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));
      
      let totalSize = 0;
      let totalLines = 0;
      
      for (const file of jsonlFiles) {
        const filePath = join(tfDir, file);
        const fileStats = await stat(filePath);
        totalSize += fileStats.size;
        
        const content = await readFile(filePath, 'utf-8');
        totalLines += content.trim().split('\n').filter(l => l.trim()).length;
      }
      
      stats[tf.name] = {
        files: jsonlFiles.length,
        totalSize,
        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
        totalLines
      };
    }
    
    res.json({ stats });
  } catch (error) {
    console.error('Error getting stats:', error);
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

    // Iniciar proceso de collector
    const scriptPath = join(process.cwd(), 'dist/scripts/ws-futures-ai.js');
    const collectorProcess = spawn('node', [
      '--dns-result-order=ipv4first',
      scriptPath,
      `--symbol=${symbol}`,
      `--interval=${timeframe}`
    ], {
      detached: true,
      stdio: 'ignore'
    });

    collectorProcess.unref();

    const pid = collectorProcess.pid;
    
    // Guardar estado del collector en la base de datos
    if (pid) {
      await CollectorDatabaseService.saveCollector({
        pid,
        timeframe,
        symbol,
        status: 'running',
        startedAt: new Date()
      });
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
    version: '1.0.0',
    endpoints: {
      health: '/health',
      logs: '/api/logs?timeframe=1m&symbol=ETHUSDT&limit=100',
      files: '/api/logs/files?timeframe=1m',
      stats: '/api/logs/stats',
      collectors: {
        start: 'POST /api/collectors/start { "timeframe": "1m", "symbol": "ETHUSDT" }',
        status: 'GET /api/collectors/status',
        stop: 'POST /api/collectors/stop { "pid": 12345 }'
      }
    },
    docs: 'https://github.com/bautistabadino/trading-bot'
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor API corriendo en puerto ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Logs API: http://localhost:${PORT}/api/logs`);
});
