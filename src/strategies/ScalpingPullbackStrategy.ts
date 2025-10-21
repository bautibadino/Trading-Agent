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
  // Medias exponenciales
  fastPeriod?: number;
  slowPeriod?: number;
  trendPeriod?: number;

  // Gestión de riesgo clásica
  atrPeriod?: number;
  atrStopMultiplier?: number;
  atrTakeProfitMultiplier?: number;

  // Compatibilidad con versiones anteriores
  positionSize?: number;

  // Indicadores adicionales - RELAJADOS
  rsiPeriod?: number;
  stochasticPeriod?: number;
  stochasticSignalPeriod?: number;

  // Gestión adaptativa de posición
  basePositionSize?: number;
  maxPositionSize?: number;
  volatilityAdjustment?: boolean;

  // Filtros de mercado - RELAJADOS
  minAtr?: number;
  maxAtr?: number;
  rsiOverbought?: number;
  rsiOversold?: number;

  // Confirmaciones opcionales - DESACTIVADAS por defecto
  requireMomentumConfirmation?: boolean;
  volumeWeighted?: boolean;
  
  // NUEVOS: Parámetros para aumentar oportunidades
  allowShallowPullbacks?: boolean;
  trendStrengthThreshold?: number;
  minRiskRewardRatio?: number;
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
 * Estrategia de scalping basada en pullbacks con filtros optimizados para mayor frecuencia
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
  private readonly allowShallowPullbacks: boolean;
  private readonly trendStrengthThreshold: number;
  private readonly minRiskRewardRatio: number;

  private pullbackLongReady = false;
  private pullbackShortReady = false;
  private shallowPullbackLongReady = false;
  private shallowPullbackShortReady = false;
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
    const fastPeriod = config.fastPeriod ?? 9;
    const slowPeriod = config.slowPeriod ?? 21;
    const trendPeriod = config.trendPeriod ?? 50;
    const atrPeriod = config.atrPeriod ?? 14;
    const rsiPeriod = config.rsiPeriod ?? 14;
    const stochasticPeriod = config.stochasticPeriod ?? 14;
    const stochasticSignalPeriod = config.stochasticSignalPeriod ?? 3;

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

    this.atrStopMultiplier = config.atrStopMultiplier ?? 1.2;
    this.atrTakeProfitMultiplier = config.atrTakeProfitMultiplier ?? 1.8;
    this.basePositionSize = config.basePositionSize ?? config.positionSize ?? 1;
    this.maxPositionSize = config.maxPositionSize ?? Math.max(this.basePositionSize * 3, this.basePositionSize);
    this.volatilityAdjustment = config.volatilityAdjustment ?? true;
    this.minAtr = config.minAtr ?? 0;
    this.maxAtr = config.maxAtr ?? Number.POSITIVE_INFINITY;
    
    // FILTROS RELAJADOS - Menos restrictivos
    this.rsiOverbought = config.rsiOverbought ?? 75;  // Más permisivo
    this.rsiOversold = config.rsiOversold ?? 25;      // Más permisivo
    
    // CONFIRMACIONES DESACTIVADAS por defecto
    this.requireMomentumConfirmation = config.requireMomentumConfirmation ?? false; // DESACTIVADO
    this.volumeWeighted = config.volumeWeighted ?? false; // DESACTIVADO
    
    // NUEVOS PARÁMETROS PARA MÁS OPERACIONES
    this.allowShallowPullbacks = config.allowShallowPullbacks ?? true;
    this.trendStrengthThreshold = config.trendStrengthThreshold ?? 0.3; // Más bajo
    this.minRiskRewardRatio = config.minRiskRewardRatio ?? 1.2; // Más bajo
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

    // Solo filtrar por ATR mínimo, no máximo
    if (indicators.atrValue < this.minAtr) {
      this.resetPullbackFlags();
      return events;
    }

    if (this.position) {
      const exitEvent = this.evaluateExit(candle, index, indicators);
      if (exitEvent) {
        events.push(exitEvent);
      }
    } else {
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
    this.shallowPullbackLongReady = false;
    this.shallowPullbackShortReady = false;
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
    
    // Solo actualizar análisis de momentum si está habilitado
    if (this.requireMomentumConfirmation || this.volumeWeighted) {
      this.updateMomentumAnalysis(candle);
    }
  }

  private updateMomentumAnalysis(candle: Candle): void {
    const bufferSize = 20; // Reducido para ser más reactivo

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
      this.atr.isStable &&
      this.rsi.isStable
      // Stochastic es opcional, no bloquear si no está estable
    );
  }

  private getIndicatorValues(): IndicatorSnapshot | null {
    const fast = this.emaFast.getResult();
    const slow = this.emaSlow.getResult();
    const trend = this.emaTrend.getResult();
    const atrValue = this.atr.getResult();
    const rsiValue = this.rsi.getResult();

    if (fast === null || slow === null || trend === null || atrValue === null || rsiValue === null) {
      return null;
    }

    return {
      fast,
      slow,
      trend,
      atrValue,
      rsiValue,
      stochastic: this.lastStochastic
    };
  }

  private updateMarketRegime(candle: Candle, indicators: IndicatorSnapshot): void {
    const trendStrength = indicators.atrValue > 0 
      ? Math.abs(indicators.fast - indicators.slow) / indicators.atrValue 
      : 0;

    // Umbral más bajo para detectar tendencia
    this.marketRegime = trendStrength > this.trendStrengthThreshold ? 'TRENDING' : 'RANGING';
  }

  private calculatePositionSize(atrValue: number, confidence: number): number {
    if (!this.volatilityAdjustment) {
      return Math.min(this.maxPositionSize, Math.max(0.1, this.basePositionSize));
    }

    const atrBaseline = this.minAtr > 0 ? this.minAtr : atrValue || 1;
    const volatilityFactor = atrValue > 0 ? Math.max(0.5, Math.min(1.5, atrBaseline / atrValue)) : 1;
    const streakFactor = this.consecutiveLosses > 2 ? 0.5 : this.consecutiveWins >= 3 ? 1.2 : 1.0;
    
    // Confidence menos restrictiva
    const confidenceFactor = 0.7 + confidence * 0.3;

    const size = this.basePositionSize * volatilityFactor * streakFactor * confidenceFactor;
    return Math.min(this.maxPositionSize, Math.max(0.1, Number(size.toFixed(4))));
  }

  private calculateConfidence(
    candle: Candle,
    indicators: IndicatorSnapshot,
    side: PositionSide
  ): number {
    let confidence = 0.6; // Base más alta

    // RSI más permisivo
    if (side === 'LONG' && indicators.rsiValue < this.rsiOverbought) {
      confidence += 0.15;
    }
    if (side === 'SHORT' && indicators.rsiValue > this.rsiOversold) {
      confidence += 0.15;
    }

    // Stochastic opcional - solo si está disponible
    const stoch = indicators.stochastic;
    if (stoch && this.stochastic.isStable) {
      if (side === 'LONG' && stoch.stochK >= stoch.stochD) {
        confidence += 0.1;
      }
      if (side === 'SHORT' && stoch.stochK <= stoch.stochD) {
        confidence += 0.1;
      }
    }

    // Volume opcional
    if (this.volumeWeighted && this.volumeSpikeDetected) {
      confidence += 0.1;
    }

    // Bonus por tendencia fuerte
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

    // Filtros de RSI más permisivos
    const rsiFilterLong = rsiValue < this.rsiOverbought;
    const rsiFilterShort = rsiValue > this.rsiOversold;

    // Risk-reward más bajo
    const minRiskReward = this.minRiskRewardRatio;

    // ENTRADAS REGULARES (pullbacks profundos)
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
            riskRewardRatio
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
            reason: `Pullback profundo en tendencia alcista | RSI: ${rsiValue.toFixed(2)}`,
            confidence,
            riskRewardRatio
          });
        }
      }
    } 
    // ENTRADAS SHALLOW (pullbacks suaves) - NUEVO
    else if (this.allowShallowPullbacks && isUptrend && this.shallowPullbackLongReady && candle.close > fast && rsiFilterLong) {
      if (this.hasMomentumConfirmation(candle, indicators, 'LONG')) {
        const confidence = this.calculateConfidence(candle, indicators, 'LONG') * 0.8; // Menos confianza
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
            riskRewardRatio
          };
          this.shallowPullbackLongReady = false;
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
            reason: `Pullback suave en tendencia alcista | RSI: ${rsiValue.toFixed(2)}`,
            confidence,
            riskRewardRatio
          });
        }
      }
    }
    // SHORT REGULAR
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
            riskRewardRatio
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
            reason: `Throwback profundo en tendencia bajista | RSI: ${rsiValue.toFixed(2)}`,
            confidence,
            riskRewardRatio
          });
        }
      }
    }
    // SHORT SHALLOW - NUEVO
    else if (this.allowShallowPullbacks && isDowntrend && this.shallowPullbackShortReady && candle.close < fast && rsiFilterShort) {
      if (this.hasMomentumConfirmation(candle, indicators, 'SHORT')) {
        const confidence = this.calculateConfidence(candle, indicators, 'SHORT') * 0.8;
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
            riskRewardRatio
          };
          this.shallowPullbackShortReady = false;
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
            reason: `Throwback suave en tendencia bajista | RSI: ${rsiValue.toFixed(2)}`,
            confidence,
            riskRewardRatio
          });
        }
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

    if (side === 'LONG') {
      if (candle.low <= stopLoss) {
        exitPrice = stopLoss;
        reason = 'Stop Loss';
      } else if (candle.high >= takeProfit) {
        exitPrice = takeProfit;
        reason = 'Take Profit';
      }
    } else {
      if (candle.high >= stopLoss) {
        exitPrice = stopLoss;
        reason = 'Stop Loss';
      } else if (candle.low <= takeProfit) {
        exitPrice = takeProfit;
        reason = 'Take Profit';
      }
    }

    if (exitPrice === null) {
      if (this.shouldExitEarly(candle, indicators, position)) {
        exitPrice = candle.close;
        reason = 'Salida anticipada por cambio de momentum';
      } else {
        return null;
      }
    }

    const pnl = side === 'LONG'
      ? (exitPrice - entryPrice) * units
      : (entryPrice - exitPrice) * units;

    const riskPerUnit = Math.abs(entryPrice - stopLoss);
    const rMultiple = riskPerUnit > 0 ? (Math.abs(pnl) / (riskPerUnit * units)) * Math.sign(pnl) : 0;
    const tradeDuration = index - entryIndex;

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

  private shouldExitEarly(
    candle: Candle,
    indicators: IndicatorSnapshot,
    position: StrategyPosition
  ): boolean {
    const { side, entryTime } = position;
    const { rsiValue, fast, slow } = indicators;

    // Salidas tempranas menos agresivas
    if (side === 'LONG' && rsiValue > 80) return true;
    if (side === 'SHORT' && rsiValue < 20) return true;

    // Reversión de tendencia principal
    if (side === 'LONG' && fast < slow) return true;
    if (side === 'SHORT' && fast > slow) return true;

    // Timeout más generoso
    const timeInTrade = candle.openTime - entryTime;
    const maxHolding = 120 * 60 * 1000; // 2 horas máximo
    if (timeInTrade > maxHolding) return true;

    return false;
  }

  private updatePullbackFlags(candle: Candle, indicators: IndicatorSnapshot): void {
    const { fast, slow, trend } = indicators;

    const isUptrend = fast > slow && candle.close > trend;
    const isDowntrend = fast < slow && candle.close < trend;

    // PULLBACKS REGULARES (profundos)
    this.pullbackLongReady = isUptrend && candle.close < fast && candle.low > slow;
    this.pullbackShortReady = isDowntrend && candle.close > fast && candle.high < slow;

    // PULLBACKS SHALLOW (suaves) - NUEVO: permitir tocar la EMA lenta
    if (this.allowShallowPullbacks) {
      this.shallowPullbackLongReady = isUptrend && candle.close < fast && candle.low <= slow && candle.low > trend;
      this.shallowPullbackShortReady = isDowntrend && candle.close > fast && candle.high >= slow && candle.high < trend;
    }
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
    this.shallowPullbackLongReady = false;
    this.shallowPullbackShortReady = false;
  }
}