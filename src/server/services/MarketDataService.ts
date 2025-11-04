import { prisma } from '../../config/prisma.js';

export interface MarketDataInput {
  timestamp: Date;
  symbol: string;
  timeframe: string;
  lastPrice: number;
  orderbook: {
    bestBid: { p: number; q: number };
    bestAsk: { p: number; q: number };
    mid: number;
    spread: number;
    spreadBps: number;
    imbalance: number;
    microprice: number;
  };
  micro_flow: {
    takerBuyQuote: number;
    takerSellQuote: number;
    takerBuyRatio: number;
  };
  indicators: {
    rsi14: number | null;
    sma20: number | null;
    ema9: number | null;
    ema21: number | null;
    volatility: number | null;
  };
  heuristics: {
    ema9Above21: boolean | null;
    rsiState: string;
    buyPressure: boolean;
  };
  market_stats: {
    fundingRate: number;
    indexPrice: number;
    volume24h: number;
    high24h: number;
    low24h: number;
    openInterest: number | null;
    liquidationVolume: number;
  };
}

export class MarketDataService {
  /**
   * Guarda datos de mercado en la base de datos
   */
  static async saveMarketData(data: MarketDataInput): Promise<void> {
    try {
      await prisma.marketData.create({
        data: {
          timestamp: data.timestamp,
          symbol: data.symbol,
          timeframe: data.timeframe,
          lastPrice: data.lastPrice,
          
          // Order Book
          bestBidPrice: data.orderbook.bestBid.p,
          bestBidQty: data.orderbook.bestBid.q,
          bestAskPrice: data.orderbook.bestAsk.p,
          bestAskQty: data.orderbook.bestAsk.q,
          midPrice: data.orderbook.mid,
          spread: data.orderbook.spread,
          spreadBps: data.orderbook.spreadBps,
          imbalance: data.orderbook.imbalance,
          microprice: data.orderbook.microprice,
          
          // Micro Flow
          takerBuyQuote: data.micro_flow.takerBuyQuote,
          takerSellQuote: data.micro_flow.takerSellQuote,
          takerBuyRatio: data.micro_flow.takerBuyRatio,
          
          // Indicators
          rsi14: data.indicators.rsi14,
          sma20: data.indicators.sma20,
          ema9: data.indicators.ema9,
          ema21: data.indicators.ema21,
          volatility: data.indicators.volatility,
          
          // Heuristics
          ema9Above21: data.heuristics.ema9Above21,
          rsiState: data.heuristics.rsiState,
          buyPressure: data.heuristics.buyPressure,
          
          // Market Stats
          fundingRate: data.market_stats.fundingRate,
          indexPrice: data.market_stats.indexPrice,
          volume24h: data.market_stats.volume24h,
          high24h: data.market_stats.high24h,
          low24h: data.market_stats.low24h,
          openInterest: data.market_stats.openInterest,
          liquidationVolume: data.market_stats.liquidationVolume,
        },
      });
    } catch (error) {
      console.error('Error guardando market data:', error);
      throw error;
    }
  }

  /**
   * Obtiene market data con filtros y paginación
   */
  static async getMarketData(options: {
    symbol?: string;
    timeframe?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const { symbol, timeframe, startDate, endDate, limit = 100, offset = 0 } = options;

    const where: any = {};
    
    if (symbol) where.symbol = symbol;
    if (timeframe) where.timeframe = timeframe;
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    const [data, total] = await Promise.all([
      prisma.marketData.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.marketData.count({ where }),
    ]);

    return { data, total, limit, offset };
  }

  /**
   * Obtiene estadísticas de market data
   */
  static async getStats(symbol?: string, timeframe?: string) {
    const where: any = {};
    if (symbol) where.symbol = symbol;
    if (timeframe) where.timeframe = timeframe;

    const total = await prisma.marketData.count({ where });
    
    const symbolsRaw = await prisma.marketData.groupBy({
      by: ['symbol'],
      _count: { _all: true },
    });

    const timeframesRaw = await prisma.marketData.groupBy({
      by: ['timeframe'],
      _count: { _all: true },
    });

    return {
      total,
      symbols: symbolsRaw.map((s: any) => ({ symbol: s.symbol, count: s._count._all })),
      timeframes: timeframesRaw.map((t: any) => ({ timeframe: t.timeframe, count: t._count._all })),
    };
  }

  /**
   * Obtiene el último registro de market data
   */
  static async getLatest(symbol: string, timeframe: string) {
    return await prisma.marketData.findFirst({
      where: { symbol, timeframe },
      orderBy: { timestamp: 'desc' },
    });
  }

  /**
   * Limpia datos antiguos (más de X días)
   */
  static async cleanupOldData(daysToKeep: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await prisma.marketData.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }
}

