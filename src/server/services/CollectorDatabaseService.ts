import { prisma } from '../../config/prisma.js';

export interface CollectorData {
  pid: number;
  timeframe: string;
  symbol: string;
  status: 'running' | 'stopped' | 'error';
  startedAt: Date;
}

export interface CollectorWithUptime extends CollectorData {
  uptime: number;
}

export class CollectorDatabaseService {
  /**
   * Guarda un nuevo collector en la base de datos
   */
  static async saveCollector(data: CollectorData): Promise<void> {
    try {
      await prisma.collector.create({
        data: {
          pid: data.pid,
          timeframe: data.timeframe,
          symbol: data.symbol,
          status: data.status,
          startedAt: data.startedAt,
        },
      });
    } catch (error) {
      console.error('Error guardando collector:', error);
      throw error;
    }
  }

  /**
   * Obtiene todos los collectors activos
   */
  static async getCollectors(): Promise<CollectorData[]> {
    try {
      const collectors = await prisma.collector.findMany({
        where: {
          status: {
            in: ['running', 'error'],
          },
        },
        orderBy: {
          startedAt: 'desc',
        },
      });

      return collectors.map(c => ({
        pid: c.pid,
        timeframe: c.timeframe,
        symbol: c.symbol,
        status: c.status as 'running' | 'stopped' | 'error',
        startedAt: c.startedAt,
      }));
    } catch (error) {
      console.error('Error obteniendo collectors:', error);
      throw error;
    }
  }

  /**
   * Verifica si un PID existe en el sistema
   */
  static isPidAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Obtiene los collectors con uptime calculado y verifica que estén vivos
   */
  static async getCollectorsWithUptime(): Promise<CollectorWithUptime[]> {
    const collectors = await this.getCollectors();
    const now = Date.now();

    // Filtrar collectors muertos y calcular uptime
    const aliveCollectors: CollectorWithUptime[] = [];

    for (const collector of collectors) {
      if (this.isPidAlive(collector.pid)) {
        const uptime = Math.floor((now - collector.startedAt.getTime()) / 1000);
        aliveCollectors.push({
          ...collector,
          uptime,
        });
      } else {
        // Marcar como stopped si el PID no existe
        await this.stopCollector(collector.pid);
      }
    }

    return aliveCollectors;
  }

  /**
   * Actualiza el estado de un collector a 'stopped'
   */
  static async stopCollector(pid: number): Promise<void> {
    try {
      await prisma.collector.updateMany({
        where: { pid },
        data: {
          status: 'stopped',
          stoppedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Error actualizando collector:', error);
      throw error;
    }
  }

  /**
   * Actualiza el estado de un collector
   */
  static async updateCollectorStatus(
    pid: number,
    status: 'running' | 'stopped' | 'error'
  ): Promise<void> {
    try {
      await prisma.collector.updateMany({
        where: { pid },
        data: {
          status,
          ...(status === 'stopped' && { stoppedAt: new Date() }),
        },
      });
    } catch (error) {
      console.error('Error actualizando estado del collector:', error);
      throw error;
    }
  }

  /**
   * Elimina collectors antiguos (stopped) de más de 7 días
   */
  static async cleanupOldCollectors(): Promise<void> {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      await prisma.collector.deleteMany({
        where: {
          status: 'stopped',
          stoppedAt: {
            lt: sevenDaysAgo,
          },
        },
      });
    } catch (error) {
      console.error('Error limpiando collectors antiguos:', error);
      throw error;
    }
  }

  /**
   * Verifica si existe un collector por PID
   */
  static async existsByPid(pid: number): Promise<boolean> {
    try {
      const count = await prisma.collector.count({
        where: { pid },
      });
      return count > 0;
    } catch (error) {
      console.error('Error verificando existencia de collector:', error);
      throw error;
    }
  }
}

