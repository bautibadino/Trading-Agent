import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

export interface CollectorData {
  pid: number;
  timeframe: string;
  symbol: string;
  status: 'running' | 'stopped' | 'error';
  startedAt: string;
  stoppedAt?: string;
}

interface CollectorState {
  collectors: CollectorData[];
}

export class CollectorStateService {
  private stateFilePath: string;

  constructor() {
    this.stateFilePath = join(process.cwd(), 'collectors-state.json');
  }

  /**
   * Lee el estado actual de los collectors desde el archivo JSON
   */
  async getState(): Promise<CollectorState> {
    try {
      if (!existsSync(this.stateFilePath)) {
        return { collectors: [] };
      }

      const content = await readFile(this.stateFilePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Error leyendo estado de collectors:', error);
      return { collectors: [] };
    }
  }

  /**
   * Guarda el estado de collectors en el archivo JSON
   */
  async saveState(state: CollectorState): Promise<void> {
    try {
      await writeFile(
        this.stateFilePath,
        JSON.stringify(state, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('Error guardando estado de collectors:', error);
      throw error;
    }
  }

  /**
   * Obtiene todos los collectors con verificación de PIDs activos
   */
  async getCollectors(): Promise<CollectorData[]> {
    const state = await this.getState();
    const activeCollectors: CollectorData[] = [];

    for (const collector of state.collectors) {
      // Solo verificar collectors que están marcados como running
      if (collector.status === 'running') {
        const isAlive = this.isProcessAlive(collector.pid);
        
        if (isAlive) {
          activeCollectors.push(collector);
        } else {
          // Proceso muerto, actualizar estado
          await this.updateCollectorStatus(collector.pid, 'stopped');
        }
      } else {
        // Incluir collectors detenidos también (para histórico)
        activeCollectors.push(collector);
      }
    }

    return activeCollectors;
  }

  /**
   * Verifica si un proceso está vivo
   */
  isProcessAlive(pid: number): boolean {
    try {
      // process.kill con señal 0 no mata, solo verifica
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Agrega un nuevo collector al estado
   */
  async addCollector(collectorData: CollectorData): Promise<void> {
    const state = await this.getState();
    
    // Remover cualquier entrada anterior con el mismo PID
    state.collectors = state.collectors.filter(c => c.pid !== collectorData.pid);
    
    // Agregar el nuevo collector
    state.collectors.push(collectorData);
    
    await this.saveState(state);
  }

  /**
   * Actualiza el estado de un collector
   */
  async updateCollectorStatus(
    pid: number,
    status: 'running' | 'stopped' | 'error'
  ): Promise<boolean> {
    const state = await this.getState();
    const collector = state.collectors.find(c => c.pid === pid);

    if (!collector) {
      return false;
    }

    collector.status = status;
    if (status === 'stopped' || status === 'error') {
      collector.stoppedAt = new Date().toISOString();
    }

    await this.saveState(state);
    return true;
  }

  /**
   * Elimina un collector del estado
   */
  async removeCollector(pid: number): Promise<boolean> {
    const state = await this.getState();
    const initialLength = state.collectors.length;
    
    state.collectors = state.collectors.filter(c => c.pid !== pid);
    
    if (state.collectors.length < initialLength) {
      await this.saveState(state);
      return true;
    }
    
    return false;
  }

  /**
   * Detiene un collector por PID
   */
  async stopCollector(pid: number): Promise<{ success: boolean; message: string }> {
    // Verificar que el proceso existe
    if (!this.isProcessAlive(pid)) {
      await this.updateCollectorStatus(pid, 'stopped');
      return {
        success: false,
        message: 'Collector no encontrado o ya detenido'
      };
    }

    try {
      // Intentar detener con SIGTERM (graceful shutdown)
      process.kill(pid, 'SIGTERM');
      
      // Actualizar estado
      await this.updateCollectorStatus(pid, 'stopped');
      
      return {
        success: true,
        message: 'Collector detenido exitosamente'
      };
    } catch (error) {
      console.error(`Error deteniendo collector ${pid}:`, error);
      return {
        success: false,
        message: `Error deteniendo collector: ${(error as Error).message}`
      };
    }
  }

  /**
   * Limpia collectors muertos del estado
   */
  async cleanupDeadCollectors(): Promise<number> {
    const state = await this.getState();
    let cleaned = 0;

    for (const collector of state.collectors) {
      if (collector.status === 'running' && !this.isProcessAlive(collector.pid)) {
        await this.updateCollectorStatus(collector.pid, 'stopped');
        cleaned++;
      }
    }

    return cleaned;
  }
}

