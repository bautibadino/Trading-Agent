import {
  ATR,
  EMA,
  RSI,
  StochasticOscillator,
  type StochasticResult
} from 'trading-signals';
import { Candle } from '../models/Candle.js';

export type PositionSide = 'LONG' | 'SHORT';

export interface StrategyConfig {
  // Medias exponenciales - OPTIMIZADAS PARA SCALPING
  fastPeriod?: number;
  slowPeriod?: number;
  trendPeriod?: number;

  // Gestión de riesgo - MÁS AGRESIVA PARA SCALPING
  atrPeriod?: number;
  atrStopMultiplier?: number;
  atrTakeProfitMultiplier?: number;

  // Compatibilidad con versiones anteriores
  positionSize?: number;

  // Indicadores adicionales - MÁS RÁPIDOS
  rsiPeriod?: number;
  stochasticPeriod?: number;
  stochasticSignalPeriod?: number;

  // Gestión adaptativa de posición
  basePositionSize?: number;
  maxPositionSize?: number;
  volatilityAdjustment?: boolean;

  // Filtros de mercado - MUY RELAJADOS
  minAtr?: number;
  maxAtr?: number;
  rsiOverbought?: number;
  rsiOversold?: number;

  // Confirmaciones opcionales - DESACTIVADAS para scalping
  requireMomentumConfirmation?: boolean;
  volumeWeighted?: boolean;

  // NUEVOS: Parámetros específicos para scalping
  maxTradeDuration?: number;
  trailingStopEnabled?: boolean;
  aggressiveMode?: boolean;
  quickScalp?: boolean;
}

export interface StrategyPosition {
  side: PositionSide;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  units: number;
  entryIndex: number;
  entryTime: number;
  atrAtEntry: number;
  riskRewardRatio: number;
  trailingStop?: number; // NUEVO: Para trailing stop
}

export interface EntryEvent {
  type: 'ENTRY';
  side: PositionSide;
  price: number;
  stopLoss: number;
  takeProfit: number;
  atr: number;
  units: number;
  index: number;
  timestamp: number;
  reason: string;
  confidence: number;
  riskRewardRatio: number;
}

export interface ExitEvent {
  type: 'EXIT';
  side: PositionSide;
  price: number;
  pnl: number;
  rMultiple: number;
  index: number;
  timestamp: number;
  reason: string;
  tradeDuration: number;
}

export type StrategyEvent = EntryEvent | ExitEvent;

type MarketRegime = 'TRENDING' | 'RANGING';

interface IndicatorSnapshot {
  fast: number;
  slow: number;
  trend: number;
  atrValue: number;
  rsiValue: number;
  stochastic: StochasticResult | null;
}

/**
 * Estrategia de scalping basada en pullbacks - OPTIMIZADA PARA 1-5 MINUTOS
 */
export class ScalpingPullbackStrategy {
  private readonly emaFast: EMA;
  private readonly emaSlow: EMA;
  private readonly emaTrend: EMA;
  private readonly atr: ATR;
  private readonly rsi: RSI;
  private readonly stochastic: StochasticOscillator;

  private readonly atrStopMultiplier: number;
  private readonly atrTakeProfitMultiplier: number;
  private readonly basePositionSize: number;
  private readonly maxPositionSize: number;
  private readonly volatilityAdjustment: boolean;
  private readonly minAtr: number;
  private readonly maxAtr: number;
  private readonly rsiOverbought: number;
  private readonly rsiOversold: number;
  private readonly requireMomentumConfirmation: boolean;
  private readonly volumeWeighted: boolean;
  
  // NUEVOS: Parámetros de scalping
  private readonly maxTradeDuration: number;
  private readonly trailingStopEnabled: boolean;
  private readonly aggressiveMode: boolean;
  private readonly quickScalp: boolean;

  private pullbackLongReady = false;
  private pullbackShortReady = false;
  private position: StrategyPosition | null = null;
  private lastCandle: Candle | null = null;
  private lastStochastic: StochasticResult | null = null;
  private consecutiveLosses = 0;
  private consecutiveWins = 0;
  private marketRegime: MarketRegime = 'TRENDING';
  private recentHighs: number[] = [];
  private recentLows: number[] = [];
  private recentVolumes: number[] = [];
  private volumeSpikeDetected = false;

  constructor(private readonly config: StrategyConfig = {}) {
    // PARÁMETROS OPTIMIZADOS PARA SCALPING 1-5M
    const fastPeriod = config.fastPeriod ?? 5;    // Más rápido
    const slowPeriod = config.slowPeriod ?? 12;   // Optimizado
    const trendPeriod = config.trendPeriod ?? 21; // Más reactivo
    const atrPeriod = config.atrPeriod ?? 10;     // Más reactivo
    const rsiPeriod = config.rsiPeriod ?? 9;      // RSI rápido
    const stochasticPeriod = config.stochasticPeriod ?? 8;
    const stochasticSignalPeriod = config.stochasticSignalPeriod ?? 2;

    this.emaFast = new EMA(fastPeriod);
    this.emaSlow = new EMA(slowPeriod);
    this.emaTrend = new EMA(trendPeriod);
    this.atr = new ATR(atrPeriod);
    this.rsi = new RSI(rsiPeriod);
    this.stochastic = new StochasticOscillator(
      stochasticPeriod,
      stochasticSignalPeriod,
      stochasticSignalPeriod
    );

    // GESTIÓN DE RIESGO MÁS AGRESIVA
    this.atrStopMultiplier = config.atrStopMultiplier ?? 2.5;   // ← Más espacio
    this.atrTakeProfitMultiplier = config.atrTakeProfitMultiplier ?? 3.0;
    this.basePositionSize = config.basePositionSize ?? config.positionSize ?? 1;
    this.maxPositionSize = config.maxPositionSize ?? Math.max(this.basePositionSize * 3, this.basePositionSize);
    this.volatilityAdjustment = config.volatilityAdjustment ?? true;
    this.minAtr = config.minAtr ?? 0.5;
    this.maxAtr = config.maxAtr ?? Number.POSITIVE_INFINITY;
    
    // FILTROS MUY RELAJADOS para máxima frecuencia
    this.rsiOverbought = config.rsiOverbought ?? 80;  // Muy permisivo
    this.rsiOversold = config.rsiOversold ?? 20;      // Muy permisivo
    
    // CONFIRMACIONES DESACTIVADAS para scalping
    this.requireMomentumConfirmation = config.requireMomentumConfirmation ?? false;
    this.volumeWeighted = config.volumeWeighted ?? false;
    
    // NUEVOS PARÁMETROS DE SCALPING
    this.maxTradeDuration = config.maxTradeDuration ?? 15; // 15 velas máximo
    this.trailingStopEnabled = config.trailingStopEnabled ?? true;
    this.aggressiveMode = config.aggressiveMode ?? true;
    this.quickScalp = config.quickScalp ?? true;
  }

  update(candle: Candle, index: number): StrategyEvent[] {
    this.lastCandle = candle;
    this.updateAllIndicators(candle);

    const events: StrategyEvent[] = [];

    if (!this.areIndicatorsStable()) {
      return events;
    }

    const indicators = this.getIndicatorValues();
    if (!indicators) {
      return events;
    }

    this.updateMarketRegime(candle, indicators);

    // Solo filtrar por ATR mínimo
    if (indicators.atrValue < this.minAtr) {
      this.resetPullbackFlags();
      return events;
    }

    // PRIORIDAD: Gestionar posición existente
    if (this.position) {
      const exitEvent = this.evaluateExit(candle, index, indicators);
      if (exitEvent) {
        events.push(exitEvent);
        // Salir inmediatamente después de cerrar para evitar entradas múltiples
        return events;
      }
    }

    // Evaluar nuevas entradas solo si no hay posición
    if (!this.position) {
      events.push(...this.evaluateEntry(candle, index, indicators));
    }

    this.updatePullbackFlags(candle, indicators);

    return events;
  }

  getOpenPosition(): StrategyPosition | null {
    return this.position;
  }

  getMarketRegime(): MarketRegime {
    return this.marketRegime;
  }

  getTradeStatistics(): { consecutiveWins: number; consecutiveLosses: number } {
    return {
      consecutiveWins: this.consecutiveWins,
      consecutiveLosses: this.consecutiveLosses
    };
  }

  reset(): void {
    this.position = null;
    this.pullbackLongReady = false;
    this.pullbackShortReady = false;
    this.lastCandle = null;
    this.lastStochastic = null;
    this.consecutiveLosses = 0;
    this.consecutiveWins = 0;
    this.marketRegime = 'TRENDING';
    this.recentHighs = [];
    this.recentLows = [];
    this.recentVolumes = [];
    this.volumeSpikeDetected = false;
  }

  private updateAllIndicators(candle: Candle): void {
    this.emaFast.update(candle.close, false);
    this.emaSlow.update(candle.close, false);
    this.emaTrend.update(candle.close, false);
    this.atr.update({ high: candle.high, low: candle.low, close: candle.close }, false);
    this.rsi.update(candle.close, false);
    const stochasticResult = this.stochastic.update(
      { high: candle.high, low: candle.low, close: candle.close },
      false
    );
    if (stochasticResult) {
      this.lastStochastic = stochasticResult;
    } else if (!this.stochastic.isStable) {
      this.lastStochastic = null;
    }
    
    // Solo actualizar análisis si está habilitado
    if (this.requireMomentumConfirmation || this.volumeWeighted) {
      this.updateMomentumAnalysis(candle);
    }
  }

  private updateMomentumAnalysis(candle: Candle): void {
    const bufferSize = 10; // Más pequeño para scalping

    this.recentHighs.push(candle.high);
    this.recentLows.push(candle.low);
    this.recentVolumes.push(candle.volume);

    if (this.recentHighs.length > bufferSize) this.recentHighs.shift();
    if (this.recentLows.length > bufferSize) this.recentLows.shift();
    if (this.recentVolumes.length > bufferSize) this.recentVolumes.shift();

    if (this.volumeWeighted && this.recentVolumes.length > 0) {
      const volumeAverage = this.recentVolumes.reduce((acc, value) => acc + value, 0) / this.recentVolumes.length;
      this.volumeSpikeDetected = volumeAverage > 0 && candle.volume > volumeAverage * 1.5;
    }
  }

  private areIndicatorsStable(): boolean {
    return (
      this.emaFast.isStable &&
      this.emaSlow.isStable &&
      this.emaTrend.isStable &&
      this.atr.isStable
      // RSI y Stochastic son opcionales para no bloquear entradas
    );
  }

  private getIndicatorValues(): IndicatorSnapshot | null {
    const fast = this.emaFast.getResult();
    const slow = this.emaSlow.getResult();
    const trend = this.emaTrend.getResult();
    const atrValue = this.atr.getResult();
    const rsiValue = this.rsi.getResult();

    if (fast === null || slow === null || trend === null || atrValue === null) {
      return null;
    }

    return {
      fast,
      slow,
      trend,
      atrValue,
      rsiValue: rsiValue ?? 50, // Valor por defecto si no está listo
      stochastic: this.lastStochastic
    };
  }

  private updateMarketRegime(candle: Candle, indicators: IndicatorSnapshot): void {
    const trendStrength = indicators.atrValue > 0 
      ? Math.abs(indicators.fast - indicators.slow) / indicators.atrValue 
      : 0;

    // Umbral más bajo para detectar tendencia en scalping
    this.marketRegime = trendStrength > 0.2 ? 'TRENDING' : 'RANGING';
  }

  private calculatePositionSize(atrValue: number, confidence: number): number {
    if (!this.volatilityAdjustment) {
      return Math.min(this.maxPositionSize, Math.max(0.1, this.basePositionSize));
    }

    const atrBaseline = this.minAtr > 0 ? this.minAtr : atrValue || 1;
    const volatilityFactor = atrValue > 0 ? Math.max(0.5, Math.min(1.5, atrBaseline / atrValue)) : 1;
    const streakFactor = this.consecutiveLosses > 2 ? 0.5 : this.consecutiveWins >= 3 ? 1.2 : 1.0;
    
    // Confidence menos restrictiva para scalping
    const confidenceFactor = 0.8 + confidence * 0.2;

    const size = this.basePositionSize * volatilityFactor * streakFactor * confidenceFactor;
    return Math.min(this.maxPositionSize, Math.max(0.1, Number(size.toFixed(4))));
  }

  private calculateConfidence(
    candle: Candle,
    indicators: IndicatorSnapshot,
    side: PositionSide
  ): number {
    let confidence = 0.7; // Base más alta para scalping

    // RSI muy permisivo
    if (side === 'LONG' && indicators.rsiValue < this.rsiOverbought) {
      confidence += 0.2;
    }
    if (side === 'SHORT' && indicators.rsiValue > this.rsiOversold) {
      confidence += 0.2;
    }

    // Stochastic opcional
    const stoch = indicators.stochastic;
    if (stoch && this.stochastic.isStable) {
      if (side === 'LONG' && stoch.stochK >= stoch.stochD) {
        confidence += 0.1;
      }
      if (side === 'SHORT' && stoch.stochK <= stoch.stochD) {
        confidence += 0.1;
      }
    }

    // Bonus por tendencia
    if (this.marketRegime === 'TRENDING') {
      confidence += 0.1;
    }

    return Math.min(0.95, confidence);
  }

  private hasMomentumConfirmation(
    candle: Candle,
    indicators: IndicatorSnapshot,
    side: PositionSide
  ): boolean {
    // Si no se requiere confirmación, siempre retorna true
    if (!this.requireMomentumConfirmation) {
      return true;
    }

    const stoch = indicators.stochastic;
    let stochasticConfirm = true;
    if (stoch && this.stochastic.isStable) {
      stochasticConfirm = side === 'LONG' 
        ? stoch.stochK >= stoch.stochD 
        : stoch.stochK <= stoch.stochD;
    }

    const volumeConfirm = !this.volumeWeighted || this.volumeSpikeDetected;

    return stochasticConfirm && volumeConfirm;
  }

  private evaluateEntry(
    candle: Candle,
    index: number,
    indicators: IndicatorSnapshot
  ): StrategyEvent[] {
    const events: StrategyEvent[] = [];
    const { fast, slow, trend, atrValue, rsiValue } = indicators;

    const isUptrend = fast > slow && candle.close > trend;
    const isDowntrend = fast < slow && candle.close < trend;

    // Filtros muy permisivos para scalping
    const rsiFilterLong = rsiValue < this.rsiOverbought;
    const rsiFilterShort = rsiValue > this.rsiOversold;

    // Risk-reward más bajo para scalping
    const minRiskReward = 1.2;

    // ENTRADAS REGULARES POR PULLBACK
    if (isUptrend && this.pullbackLongReady && candle.close > fast && rsiFilterLong) {
      if (this.hasMomentumConfirmation(candle, indicators, 'LONG')) {
        const confidence = this.calculateConfidence(candle, indicators, 'LONG');
        const positionSize = this.calculatePositionSize(atrValue, confidence);

        const stopLoss = candle.close - atrValue * this.atrStopMultiplier;
        const takeProfit = candle.close + atrValue * this.atrTakeProfitMultiplier;
        const riskRewardRatio = stopLoss < candle.close
          ? (takeProfit - candle.close) / (candle.close - stopLoss)
          : 0;

        if (riskRewardRatio >= minRiskReward) {
          this.position = {
            side: 'LONG',
            entryPrice: candle.close,
            stopLoss,
            takeProfit,
            units: positionSize,
            entryIndex: index,
            entryTime: candle.openTime,
            atrAtEntry: atrValue,
            riskRewardRatio,
            trailingStop: this.trailingStopEnabled ? stopLoss : undefined
          };
          this.pullbackLongReady = false;
          events.push({
            type: 'ENTRY',
            side: 'LONG',
            price: candle.close,
            stopLoss,
            takeProfit,
            atr: atrValue,
            units: positionSize,
            index,
            timestamp: candle.openTime,
            reason: `PULLBACK LONG | RSI:${rsiValue.toFixed(1)}`,
            confidence,
            riskRewardRatio
          });
        }
      }
    } 
    // ENTRADAS SHORT POR THROWBACK
    else if (isDowntrend && this.pullbackShortReady && candle.close < fast && rsiFilterShort) {
      if (this.hasMomentumConfirmation(candle, indicators, 'SHORT')) {
        const confidence = this.calculateConfidence(candle, indicators, 'SHORT');
        const positionSize = this.calculatePositionSize(atrValue, confidence);

        const stopLoss = candle.close + atrValue * this.atrStopMultiplier;
        const takeProfit = candle.close - atrValue * this.atrTakeProfitMultiplier;
        const riskRewardRatio = takeProfit < candle.close
          ? (candle.close - takeProfit) / (stopLoss - candle.close)
          : 0;

        if (riskRewardRatio >= minRiskReward) {
          this.position = {
            side: 'SHORT',
            entryPrice: candle.close,
            stopLoss,
            takeProfit,
            units: positionSize,
            entryIndex: index,
            entryTime: candle.openTime,
            atrAtEntry: atrValue,
            riskRewardRatio,
            trailingStop: this.trailingStopEnabled ? stopLoss : undefined
          };
          this.pullbackShortReady = false;
          events.push({
            type: 'ENTRY',
            side: 'SHORT',
            price: candle.close,
            stopLoss,
            takeProfit,
            atr: atrValue,
            units: positionSize,
            index,
            timestamp: candle.openTime,
            reason: `THROWBACK SHORT | RSI:${rsiValue.toFixed(1)}`,
            confidence,
            riskRewardRatio
          });
        }
      }
    }

    // ENTRADAS AGRESIVAS ADICIONALES (modo scalping)
    if (this.aggressiveMode && !this.position) {
      events.push(...this.evaluateAggressiveEntries(candle, index, indicators));
    }

    return events;
  }

  private evaluateAggressiveEntries(
    candle: Candle,
    index: number,
    indicators: IndicatorSnapshot
  ): StrategyEvent[] {
    const events: StrategyEvent[] = [];
    const { fast, slow, trend, atrValue, rsiValue } = indicators;

    const isUptrend = fast > slow && candle.close > trend;
    const isDowntrend = fast < slow && candle.close < trend;

    // ENTRADA AGRESIVA LONG: Momentum alcista fuerte
    if (isUptrend && candle.close > fast && rsiValue < 75) {
      const stopLoss = candle.close - atrValue * this.atrStopMultiplier;
      const takeProfit = candle.close + atrValue * this.atrTakeProfitMultiplier;
      const riskRewardRatio = stopLoss < candle.close
        ? (takeProfit - candle.close) / (candle.close - stopLoss)
        : 0;

      if (riskRewardRatio >= 1.2) {
        const confidence = 0.8; // Alta confianza para entradas agresivas
        const positionSize = this.calculatePositionSize(atrValue, confidence);

        this.position = {
          side: 'LONG',
          entryPrice: candle.close,
          stopLoss,
          takeProfit,
          units: positionSize,
          entryIndex: index,
          entryTime: candle.openTime,
          atrAtEntry: atrValue,
          riskRewardRatio,
          trailingStop: this.trailingStopEnabled ? stopLoss : undefined
        };

        events.push({
          type: 'ENTRY',
          side: 'LONG',
          price: candle.close,
          stopLoss,
          takeProfit,
          atr: atrValue,
          units: positionSize,
          index,
          timestamp: candle.openTime,
          reason: `AGGRESSIVE LONG | Momentum`,
          confidence,
          riskRewardRatio
        });
      }
    }
    // ENTRADA AGRESIVA SHORT: Momentum bajista fuerte
    else if (isDowntrend && candle.close < fast && rsiValue > 25) {
      const stopLoss = candle.close + atrValue * this.atrStopMultiplier;
      const takeProfit = candle.close - atrValue * this.atrTakeProfitMultiplier;
      const riskRewardRatio = takeProfit < candle.close
        ? (candle.close - takeProfit) / (stopLoss - candle.close)
        : 0;

      if (riskRewardRatio >= 1.2) {
        const confidence = 0.8;
        const positionSize = this.calculatePositionSize(atrValue, confidence);

        this.position = {
          side: 'SHORT',
          entryPrice: candle.close,
          stopLoss,
          takeProfit,
          units: positionSize,
          entryIndex: index,
          entryTime: candle.openTime,
          atrAtEntry: atrValue,
          riskRewardRatio,
          trailingStop: this.trailingStopEnabled ? stopLoss : undefined
        };

        events.push({
          type: 'ENTRY',
          side: 'SHORT',
          price: candle.close,
          stopLoss,
          takeProfit,
          atr: atrValue,
          units: positionSize,
          index,
          timestamp: candle.openTime,
          reason: `AGGRESSIVE SHORT | Momentum`,
          confidence,
          riskRewardRatio
        });
      }
    }

    return events;
  }

  private evaluateExit(
    candle: Candle,
    index: number,
    indicators: IndicatorSnapshot
  ): ExitEvent | null {
    if (!this.position) {
      return null;
    }

    const position = this.position;
    const { side, stopLoss, takeProfit, entryPrice, units, entryIndex, entryTime } = position;

    let exitPrice: number | null = null;
    let reason = '';

    // ACTUALIZAR TRAILING STOP
    if (this.trailingStopEnabled && position.trailingStop !== undefined) {
      if (side === 'LONG' && candle.close > entryPrice) {
        const newTrailingStop = candle.close - indicators.atrValue * this.atrStopMultiplier * 0.8;
        if (newTrailingStop > position.trailingStop) {
          position.trailingStop = newTrailingStop;
        }
      } else if (side === 'SHORT' && candle.close < entryPrice) {
        const newTrailingStop = candle.close - indicators.atrValue * this.atrStopMultiplier * 0.8;
        if (newTrailingStop < position.trailingStop) {
          position.trailingStop = newTrailingStop;
        }
      }
    }

    const currentStop = position.trailingStop !== undefined ? position.trailingStop : stopLoss;

    // VERIFICAR SALIDAS
    if (side === 'LONG') {
      if (candle.low <= currentStop) {
        exitPrice = currentStop;
        reason = this.trailingStopEnabled ? 'Trailing Stop' : 'Stop Loss';
      } else if (candle.high >= takeProfit) {
        exitPrice = takeProfit;
        reason = 'Take Profit';
      }
    } else {
      if (candle.high >= currentStop) {
        exitPrice = currentStop;
        reason = this.trailingStopEnabled ? 'Trailing Stop' : 'Stop Loss';
      } else if (candle.low <= takeProfit) {
        exitPrice = takeProfit;
        reason = 'Take Profit';
      }
    }

    // SALIDA POR TIMEOUT (scalping)
    const tradeDuration = index - entryIndex;
    if (!exitPrice && tradeDuration >= this.maxTradeDuration) {
      exitPrice = candle.close;
      reason = 'Max Duration';
    }

    if (exitPrice === null) {
      return null;
    }

    const pnl = side === 'LONG'
      ? (exitPrice - entryPrice) * units
      : (entryPrice - exitPrice) * units;

    const riskPerUnit = Math.abs(entryPrice - stopLoss);
    const rMultiple = riskPerUnit > 0 ? (Math.abs(pnl) / (riskPerUnit * units)) * Math.sign(pnl) : 0;

    this.position = null;
    this.updateTradeStatistics(pnl >= 0);

    return {
      type: 'EXIT',
      side,
      price: exitPrice,
      pnl,
      rMultiple,
      index,
      timestamp: candle.closeTime,
      reason,
      tradeDuration
    };
  }

  private updatePullbackFlags(candle: Candle, indicators: IndicatorSnapshot): void {
    const { fast, slow, trend } = indicators;

    const isUptrend = fast > slow && candle.close > trend;
    const isDowntrend = fast < slow && candle.close < trend;

    // DETECCIÓN MÁS SENSIBLE para scalping
    this.pullbackLongReady = isUptrend && candle.close < fast;
    this.pullbackShortReady = isDowntrend && candle.close > fast;
  }

  private updateTradeStatistics(isWin: boolean): void {
    if (isWin) {
      this.consecutiveWins += 1;
      this.consecutiveLosses = 0;
    } else {
      this.consecutiveLosses += 1;
      this.consecutiveWins = 0;
    }
  }

  private resetPullbackFlags(): void {
    this.pullbackLongReady = false;
    this.pullbackShortReady = false;
  }
}