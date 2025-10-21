import axios, { AxiosInstance } from 'axios';
import { createHmac } from 'node:crypto';
import { Candle, CandleArray, CandleSource } from '../models/Candle.js';
import { Trade } from '../models/Trade.js';

type Primitive = string | number | boolean | undefined;

export interface KlinesOptions {
  limit?: number;
  startTime?: number;
  endTime?: number;
}

export interface HistoricalKlinesOptions extends KlinesOptions {
  interval: string;
}

export interface AggTradesOptions {
  fromId?: number;
  startTime?: number;
  endTime?: number;
  limit?: number;
}

export interface OrderBook {
  lastUpdateId: number;
  bids: Array<[string, string]>;
  asks: Array<[string, string]>;
}

export interface RecentTradeResponse {
  id: number;
  price: string;
  qty: string;
  quoteQty: string;
  time: number;
  isBuyerMaker: boolean;
  isBestMatch: boolean;
}

export interface AggTradeResponse {
  a: number;
  p: string;
  q: string;
  f: number;
  l: number;
  T: number;
  m: boolean;
  M: boolean;
}

export interface AccountBalance {
  asset: string;
  free: string;
  locked: string;
}

export interface AccountInformation {
  accountType: string;
  canDeposit: boolean;
  canTrade: boolean;
  canWithdraw: boolean;
  updateTime: number;
  balances: AccountBalance[];
  permissions: string[];
  [key: string]: unknown;
}

interface ExchangeInfo {
  symbols: Array<{ symbol: string }>;
}

/**
 * Cliente para interactuar con la API de Binance
 */
export class BinanceClient {
  private readonly apiKey?: string;
  private readonly apiSecret?: string;
  private readonly baseURL = 'https://api.binance.com';
  private readonly futuresURL = 'https://fapi.binance.com';
  private readonly client: AxiosInstance;

  constructor(apiKey?: string | null, apiSecret?: string | null) {
    this.apiKey = apiKey ?? process.env.BINANCE_API_KEY ?? undefined;
    this.apiSecret = apiSecret ?? process.env.BINANCE_API_SECRET ?? undefined;

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10_000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.client.interceptors.request.use((config) => {
      if (this.apiKey) {
        config.headers = config.headers ?? {};
        if (!('X-MBX-APIKEY' in config.headers)) {
          (config.headers as Record<string, unknown>)['X-MBX-APIKEY'] = this.apiKey;
        }
      }
      return config;
    });
  }

  private generateSignature(queryString: string): string {
    if (!this.apiSecret) {
      throw new Error('API Secret es requerido para requests firmados');
    }
    return createHmac('sha256', this.apiSecret).update(queryString).digest('hex');
  }

  private buildSignedQueryString(params: Record<string, Primitive> = {}): string {
    const timestamp = Date.now();
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        query.append(key, String(value));
      }
    }
    query.append('timestamp', String(timestamp));
    const queryString = query.toString();
    const signature = this.generateSignature(queryString);
    return `${queryString}&signature=${signature}`;
  }

  async ping(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/v3/ping');
      return response.status === 200;
    } catch (error) {
      console.error('Error en ping:', (error as Error).message);
      return false;
    }
  }

  async getServerTime(): Promise<number> {
    const response = await this.client.get<{ serverTime: number }>('/api/v3/time');
    return response.data.serverTime;
  }

  async getExchangeInfo(): Promise<ExchangeInfo> {
    const response = await this.client.get<ExchangeInfo>('/api/v3/exchangeInfo');
    return response.data;
  }

  async getKlines(symbol: string, interval: string, options: KlinesOptions = {}): Promise<Candle[]> {
    const params = {
      symbol: symbol.toUpperCase(),
      interval,
      ...options
    };

    const response = await this.client.get<CandleArray[]>('/api/v3/klines', {
      params
    });

    return response.data.map((kline) => new Candle(kline as CandleSource));
  }

  async getHistoricalKlines(symbol: string, interval: string, startTime: number, endTime: number): Promise<Candle[]> {
    const allKlines: Candle[] = [];
    let currentStartTime = startTime;
    const maxLimit = 1000;

    while (currentStartTime < endTime) {
      const klines = await this.getKlines(symbol, interval, {
        startTime: currentStartTime,
        endTime,
        limit: maxLimit
      });

      if (klines.length === 0) {
        break;
      }

      allKlines.push(...klines);
      const lastCandle = klines[klines.length - 1];
      currentStartTime = lastCandle.closeTime + 1;

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return allKlines;
  }

  async getCurrentPrice(symbol: string): Promise<{ symbol: string; price: number }> {
    const response = await this.client.get<{ symbol: string; price: string }>('/api/v3/ticker/price', {
      params: { symbol: symbol.toUpperCase() }
    });

    return {
      symbol: response.data.symbol,
      price: parseFloat(response.data.price)
    };
  }

  async get24hrTicker(symbol: string): Promise<Record<string, string>> {
    const response = await this.client.get<Record<string, string>>('/api/v3/ticker/24hr', {
      params: { symbol: symbol.toUpperCase() }
    });
    return response.data;
  }

  async getOrderBook(symbol: string, limit = 100): Promise<OrderBook> {
    const response = await this.client.get<OrderBook>('/api/v3/depth', {
      params: {
        symbol: symbol.toUpperCase(),
        limit
      }
    });
    return response.data;
  }

  async getRecentTrades(symbol: string, limit = 500): Promise<Trade[]> {
    const response = await this.client.get<RecentTradeResponse[]>('/api/v3/trades', {
      params: {
        symbol: symbol.toUpperCase(),
        limit
      }
    });

    return response.data.map(
      (trade) =>
        new Trade({
          id: trade.id,
          price: trade.price,
          quantity: trade.qty,
          timestamp: trade.time,
          isBuyerMaker: trade.isBuyerMaker,
          symbol: symbol.toUpperCase()
        })
    );
  }

  async getAggTrades(symbol: string, options: AggTradesOptions = {}): Promise<AggTradeResponse[]> {
    const params = {
      symbol: symbol.toUpperCase(),
      ...options
    };

    const response = await this.client.get<AggTradeResponse[]>('/api/v3/aggTrades', {
      params
    });

    return response.data;
  }

  async getAccountInfo(): Promise<AccountInformation> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('API Key y Secret son requeridos para obtener información de la cuenta');
    }

    const queryString = this.buildSignedQueryString();
    const response = await this.client.get<AccountInformation>(`/api/v3/account?${queryString}`);
    return response.data;
  }

  async getOpenOrders(symbol?: string): Promise<unknown[]> {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('API Key y Secret son requeridos para obtener órdenes abiertas');
    }

    const params: Record<string, Primitive> = {};
    if (symbol) {
      params.symbol = symbol.toUpperCase();
    }

    const queryString = this.buildSignedQueryString(params);
    const response = await this.client.get<unknown[]>(`/api/v3/openOrders?${queryString}`);
    return response.data;
  }

  async validateSymbol(symbol: string): Promise<boolean> {
    try {
      const exchangeInfo = await this.getExchangeInfo();
      const validSymbols = exchangeInfo.symbols.map((s) => s.symbol);
      return validSymbols.includes(symbol.toUpperCase());
    } catch (error) {
      console.error('Error validando símbolo:', (error as Error).message);
      return false;
    }
  }

  getValidIntervals(): string[] {
    return ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'];
  }
}
