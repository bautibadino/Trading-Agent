import { ATR, EMA } from 'trading-signals';
import { Candle } from '../models/Candle.js';

export type PositionSide = 'LONG' | 'SHORT';

export interface StrategyConfig {
  fastPeriod?: number;
  slowPeriod?: number;
  trendPeriod?: number;
  atrPeriod?: number;
  atrStopMultiplier?: number;
  atrTakeProfitMultiplier?: number;
  positionSize?: number;
  minAtr?: number;
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
}

export type StrategyEvent = EntryEvent | ExitEvent;

/**
 * Estrategia de scalping basada en pullbacks/throwbacks usando medias exponenciales y ATR.
 */
export class ScalpingPullbackStrategy {
  private readonly emaFast: EMA;
  private readonly emaSlow: EMA;
  private readonly emaTrend: EMA;
  private readonly atr: ATR;

  private readonly atrStopMultiplier: number;
  private readonly atrTakeProfitMultiplier: number;
  private readonly positionSize: number;
  private readonly minAtr: number;

  private pullbackLongReady = false;
  private pullbackShortReady = false;
  private position: StrategyPosition | null = null;
  private lastCandle: Candle | null = null;

  constructor(private readonly config: StrategyConfig = {}) {
    const fastPeriod = config.fastPeriod ?? 9;
    const slowPeriod = config.slowPeriod ?? 21;
    const trendPeriod = config.trendPeriod ?? 50;
    const atrPeriod = config.atrPeriod ?? 14;

    this.emaFast = new EMA(fastPeriod);
    this.emaSlow = new EMA(slowPeriod);
    this.emaTrend = new EMA(trendPeriod);
    this.atr = new ATR(atrPeriod);

    this.atrStopMultiplier = config.atrStopMultiplier ?? 1.2;
    this.atrTakeProfitMultiplier = config.atrTakeProfitMultiplier ?? 1.8;
    this.positionSize = config.positionSize ?? 1;
    this.minAtr = config.minAtr ?? 0;
  }

  update(candle: Candle, index: number): StrategyEvent[] {
    this.lastCandle = candle;
    this.emaFast.update(candle.close, false);
    this.emaSlow.update(candle.close, false);
    this.emaTrend.update(candle.close, false);
    this.atr.update({ high: candle.high, low: candle.low, close: candle.close }, false);

    const events: StrategyEvent[] = [];

    if (!this.emaFast.isStable || !this.emaSlow.isStable || !this.emaTrend.isStable || !this.atr.isStable) {
      return events;
    }

    const fastResult = this.emaFast.getResult();
    const slowResult = this.emaSlow.getResult();
    const trendResult = this.emaTrend.getResult();
    const atrResult = this.atr.getResult();

    if (fastResult === null || slowResult === null || trendResult === null || atrResult === null) {
      return events;
    }

    const fast = fastResult;
    const slow = slowResult;
    const trend = trendResult;
    const atrValue = atrResult;

    if (atrValue < this.minAtr) {
      this.pullbackLongReady = false;
      this.pullbackShortReady = false;
      return events;
    }

    if (this.position) {
      const exitEvent = this.evaluateExit(candle, index);
      if (exitEvent) {
        events.push(exitEvent);
      }
    } else {
      events.push(...this.evaluateEntry(candle, index, fast, slow, trend, atrValue));
    }

    this.updatePullbackFlags(candle, fast, slow, trend);

    return events;
  }

  getOpenPosition(): StrategyPosition | null {
    return this.position;
  }

  reset(): void {
    this.position = null;
    this.pullbackLongReady = false;
    this.pullbackShortReady = false;
    this.lastCandle = null;
  }

  private evaluateEntry(
    candle: Candle,
    index: number,
    fast: number,
    slow: number,
    trend: number,
    atrValue: number
  ): StrategyEvent[] {
    const events: StrategyEvent[] = [];

    const isUptrend = fast > slow && candle.close > trend;
    const isDowntrend = fast < slow && candle.close < trend;

    if (isUptrend && this.pullbackLongReady && candle.close > fast) {
      const stopLoss = candle.close - atrValue * this.atrStopMultiplier;
      const takeProfit = candle.close + atrValue * this.atrTakeProfitMultiplier;
      this.position = {
        side: 'LONG',
        entryPrice: candle.close,
        stopLoss,
        takeProfit,
        units: this.positionSize,
        entryIndex: index,
        entryTime: candle.openTime,
        atrAtEntry: atrValue
      };
      this.pullbackLongReady = false;
      events.push({
        type: 'ENTRY',
        side: 'LONG',
        price: candle.close,
        stopLoss,
        takeProfit,
        atr: atrValue,
        units: this.positionSize,
        index,
        timestamp: candle.openTime,
        reason: 'Pullback confirmado en tendencia alcista'
      });
    } else if (isDowntrend && this.pullbackShortReady && candle.close < fast) {
      const stopLoss = candle.close + atrValue * this.atrStopMultiplier;
      const takeProfit = candle.close - atrValue * this.atrTakeProfitMultiplier;
      this.position = {
        side: 'SHORT',
        entryPrice: candle.close,
        stopLoss,
        takeProfit,
        units: this.positionSize,
        entryIndex: index,
        entryTime: candle.openTime,
        atrAtEntry: atrValue
      };
      this.pullbackShortReady = false;
      events.push({
        type: 'ENTRY',
        side: 'SHORT',
        price: candle.close,
        stopLoss,
        takeProfit,
        atr: atrValue,
        units: this.positionSize,
        index,
        timestamp: candle.openTime,
        reason: 'Throwback confirmado en tendencia bajista'
      });
    }

    return events;
  }

  private evaluateExit(candle: Candle, index: number): ExitEvent | null {
    if (!this.position) {
      return null;
    }

    const position = this.position;
    const { side, stopLoss, takeProfit, entryPrice, units } = position;
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
      return null;
    }

    const pnl =
      side === 'LONG'
        ? (exitPrice - entryPrice) * units
        : (entryPrice - exitPrice) * units;

    const riskPerUnit = Math.abs(entryPrice - stopLoss);
    const rMultiple = riskPerUnit > 0 ? (Math.abs(pnl) / (riskPerUnit * units)) * Math.sign(pnl) : 0;

    this.position = null;

    return {
      type: 'EXIT',
      side,
      price: exitPrice,
      pnl,
      rMultiple,
      index,
      timestamp: candle.closeTime,
      reason
    };
  }

  private updatePullbackFlags(candle: Candle, fast: number, slow: number, trend: number): void {
    const isUptrend = fast > slow && candle.close > trend;
    const isDowntrend = fast < slow && candle.close < trend;

    if (isUptrend) {
      if (candle.close < fast) {
        this.pullbackLongReady = true;
      }
    } else {
      this.pullbackLongReady = false;
    }

    if (isDowntrend) {
      if (candle.close > fast) {
        this.pullbackShortReady = true;
      }
    } else {
      this.pullbackShortReady = false;
    }
  }
}
