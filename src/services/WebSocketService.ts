import WebSocket, { ClientOptions } from 'ws';
import { EventEmitter } from 'events';
import { Candle } from '../models/Candle.js';
import { Trade } from '../models/Trade.js';

export interface StreamOptions {
  autoReconnect?: boolean;
  onMessage?: (data: any) => void;
  onError?: (error: Error) => void;
  onClose?: (code: number, reason: Buffer) => void;
  onOpen?: () => void;
  heartbeatInterval?: number;
  connectionTimeout?: number;
  clientOptions?: ClientOptions;
}

export interface WebSocketErrorPayload {
  stream?: string;
  streams?: string;
  error: Error;
}

type StreamIdentifier = string;

/**
 * Servicio WebSocket para recibir datos en tiempo real de Binance
 */
export class WebSocketService extends EventEmitter {
  private wsConnections: Map<StreamIdentifier, WebSocket>;
  private reconnectAttempts: Map<StreamIdentifier, number>;
  private heartbeatIntervals: Map<StreamIdentifier, NodeJS.Timeout>;
  private connectionTimeouts: Map<StreamIdentifier, NodeJS.Timeout>;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectDelay = 1000;
  private readonly maxReconnectDelay = 30_000;
  private readonly defaultHeartbeatInterval = 30_000;
  private readonly defaultConnectionTimeout = 10_000;

  constructor() {
    super();
    this.wsConnections = new Map();
    this.reconnectAttempts = new Map();
    this.heartbeatIntervals = new Map();
    this.connectionTimeouts = new Map();
  }

  connectToStream(stream: string, options: StreamOptions = {}): WebSocket {
    const {
      autoReconnect = true,
      onMessage,
      onError,
      onClose,
      onOpen,
      heartbeatInterval = this.defaultHeartbeatInterval,
      connectionTimeout = this.defaultConnectionTimeout,
      clientOptions
    } = options;

    const wsUrl = `wss://stream.binance.com:9443/ws/${stream}`;

    console.log(`🔌 Conectando a stream: ${stream}`);
    console.log(`🔗 URL: ${wsUrl}`);
    console.log(`⏱️  Timeout de conexión: ${connectionTimeout}ms`);
    console.log(
      heartbeatInterval > 0
        ? `💓 Intervalo de heartbeat: ${heartbeatInterval}ms`
        : '💓 Heartbeat: deshabilitado'
    );

    const ws = new WebSocket(wsUrl, {
      handshakeTimeout: connectionTimeout,
      perMessageDeflate: false,
      ...(clientOptions ?? {})
    });

    ws.on('open', () => {
      console.log(`✅ Conectado a stream: ${stream}`);
      this.reconnectAttempts.set(stream, 0);

      const timeoutId = this.connectionTimeouts.get(stream);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.connectionTimeouts.delete(stream);
      }

      if (heartbeatInterval > 0) {
        this.startHeartbeat(stream, heartbeatInterval);
      }

      onOpen?.();
      this.emit('connected', { stream, ws });
    });

    ws.on('message', (raw) => {
      try {
        const parsed = JSON.parse(raw.toString());
        this.emit('data', { stream, data: parsed });
        onMessage?.(parsed);
      } catch (error) {
        console.error(`Error parseando mensaje de ${stream}:`, (error as Error).message);
        this.emitErrorEvent({ stream, error: error as Error });
      }
    });

    ws.on('error', (error) => {
      console.error(`❌ Error en stream ${stream}:`, error.message);

      const timeoutId = this.connectionTimeouts.get(stream);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.connectionTimeouts.delete(stream);
      }

      this.stopHeartbeat(stream);
      onError?.(error);
      this.emitErrorEvent({ stream, error });

      if (autoReconnect) {
        this.scheduleReconnect(stream, options);
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`🔌 Conexión cerrada ${stream}: ${code} - ${reason.toString()}`);

      this.stopHeartbeat(stream);
      onClose?.(code, reason);
      this.emit('disconnected', { stream, code, reason: reason.toString() });

      if (autoReconnect) {
        this.scheduleReconnect(stream, options);
      }
    });

    const connectionTimeoutId = setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        console.log(`⏰ Timeout de conexión para ${stream} (${connectionTimeout}ms)`);
        ws.terminate();
        this.connectionTimeouts.delete(stream);
      }
    }, connectionTimeout);

    this.connectionTimeouts.set(stream, connectionTimeoutId);
    this.wsConnections.set(stream, ws);

    return ws;
  }

  connectToMultipleStreams(streams: string[], options: StreamOptions = {}): WebSocket {
    const streamNames = streams.join('/');
    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streamNames}`;

    console.log(`🔌 Conectando a múltiples streams: ${streamNames}`);

    const ws = new WebSocket(wsUrl, {
      handshakeTimeout: options.connectionTimeout ?? this.defaultConnectionTimeout,
      perMessageDeflate: false,
      ...(options.clientOptions ?? {})
    });

    ws.on('open', () => {
      console.log(`✅ Conectado a múltiples streams: ${streamNames}`);
      this.emit('connected', { streams: streamNames, ws });
    });

    ws.on('message', (raw) => {
      try {
        const parsed = JSON.parse(raw.toString());
        if (parsed.stream && parsed.data) {
          this.emit('data', { stream: parsed.stream, data: parsed.data });
          this.emitStreamSpecificEvent(parsed.stream, parsed.data);
          options.onMessage?.(parsed);
        }
      } catch (error) {
        console.error('Error parseando mensaje de múltiples streams:', (error as Error).message);
        this.emitErrorEvent({ streams: streamNames, error: error as Error });
      }
    });

    ws.on('error', (error) => {
      console.error(`❌ Error en múltiples streams:`, error.message);
      options.onError?.(error);
      this.emitErrorEvent({ streams: streamNames, error });
    });

    ws.on('close', (code, reason) => {
      console.log(`🔌 Conexión cerrada múltiples streams: ${code} - ${reason.toString()}`);
      options.onClose?.(code, reason);
      this.emit('disconnected', { streams: streamNames, code, reason: reason.toString() });
    });

    this.wsConnections.set(streamNames, ws);
    return ws;
  }

  private emitStreamSpecificEvent(stream: string, raw: unknown): void {
    if (stream.includes('@trade')) {
      const data = raw as { t: number; p: string; q: string; T: number; m: boolean; s: string };
      const trade = new Trade({
        id: data.t,
        price: data.p,
        quantity: data.q,
        timestamp: data.T,
        isBuyerMaker: data.m,
        symbol: data.s
      });
      this.emit('trade', { stream, trade });
    } else if (stream.includes('@kline')) {
      const data = raw as { k: any };
      const candle = new Candle(data.k);
      this.emit('kline', { stream, candle });
    } else if (stream.includes('@ticker')) {
      this.emit('ticker', { stream, ticker: raw });
    } else if (stream.includes('@bookTicker')) {
      this.emit('bookTicker', { stream, bookTicker: raw });
    } else if (stream.includes('@depth')) {
      this.emit('depth', { stream, depth: raw });
    }
  }

  connectToTrades(symbol: string, callback: (trade: Trade) => void, options: StreamOptions = {}): WebSocket {
    const stream = `${symbol.toLowerCase()}@trade`;
    return this.connectToStream(stream, {
      ...options,
      onMessage: (raw) => {
        const data = raw as { t: number; p: string; q: string; T: number; m: boolean; s: string };
        const tradeData = {
          id: data.t,
          price: data.p,
          quantity: data.q,
          timestamp: data.T,
          isBuyerMaker: data.m,
          symbol: data.s
        };
        callback(new Trade(tradeData));
        options.onMessage?.(data);
      }
    });
  }

  connectToKlines(symbol: string, interval: string, callback: (candle: Candle) => void, options: StreamOptions = {}): WebSocket {
    const stream = `${symbol.toLowerCase()}@kline_${interval}`;
    return this.connectToStream(stream, {
      ...options,
      onMessage: (raw) => {
        const data = raw as { k: { t: number; o: string; h: string; l: string; c: string; v: string; T: number; q: string; n: number; V: string; Q: string; B?: unknown } };
        const candleData = {
          openTime: data.k.t,
          open: parseFloat(data.k.o),
          high: parseFloat(data.k.h),
          low: parseFloat(data.k.l),
          close: parseFloat(data.k.c),
          volume: parseFloat(data.k.v),
          closeTime: data.k.T,
          quoteVolume: parseFloat(data.k.q),
          trades: data.k.n,
          takerBuyBaseVolume: parseFloat(data.k.V),
          takerBuyQuoteVolume: parseFloat(data.k.Q),
          ignore: data.k.B
        };
        callback(new Candle(candleData));
        options.onMessage?.(data);
      }
    });
  }

  connectToTicker(symbol: string, callback: (ticker: Record<string, unknown>) => void, options: StreamOptions = {}): WebSocket {
    const stream = `${symbol.toLowerCase()}@ticker`;
    return this.connectToStream(stream, {
      ...options,
      onMessage: (raw) => {
        const data = raw as Record<string, unknown>;
        callback(data);
        options.onMessage?.(data);
      }
    });
  }

  connectToOrderBook(symbol: string, callback: (orderBook: { bids?: [string, string][]; asks?: [string, string][] }) => void, options: StreamOptions = {}): WebSocket {
    const stream = `${symbol.toLowerCase()}@depth`;
    return this.connectToStream(stream, {
      ...options,
      onMessage: (raw) => {
        const data = raw as { bids?: [string, string][]; asks?: [string, string][] };
        callback(data);
        options.onMessage?.(data);
      }
    });
  }

  connectToBookTicker(symbol: string, callback: (ticker: { b: string; a: string } & Record<string, unknown>) => void, options: StreamOptions = {}): WebSocket {
    const stream = `${symbol.toLowerCase()}@bookTicker`;
    return this.connectToStream(stream, {
      ...options,
      onMessage: (raw) => {
        const data = raw as { b: string; a: string } & Record<string, unknown>;
        callback(data);
        options.onMessage?.(data);
      }
    });
  }

  connectToMiniTicker(callback: (data: any) => void, options: StreamOptions = {}): WebSocket {
    const stream = '!miniTicker@arr';
    return this.connectToStream(stream, {
      ...options,
      onMessage: (raw) => {
        const data = raw as any;
        callback(data);
        options.onMessage?.(data);
      }
    });
  }

  connectToAllBookTickers(callback: (data: any) => void, options: StreamOptions = {}): WebSocket {
    const stream = '!bookTicker';
    return this.connectToStream(stream, {
      ...options,
      onMessage: (raw) => {
        const data = raw as any;
        callback(data);
        options.onMessage?.(data);
      }
    });
  }

  private startHeartbeat(stream: string, interval: number): void {
    this.stopHeartbeat(stream);

    const heartbeatId = setInterval(() => {
      const ws = this.wsConnections.get(stream);
      if (ws && ws.readyState === WebSocket.OPEN) {
        console.log(`💓 Enviando ping a ${stream}`);
        ws.ping();
      } else {
        console.log(`💔 Heartbeat detenido para ${stream} - conexión cerrada`);
        this.stopHeartbeat(stream);
      }
    }, interval);

    this.heartbeatIntervals.set(stream, heartbeatId);
    console.log(`💓 Heartbeat iniciado para ${stream} (cada ${interval}ms)`);
  }

  private stopHeartbeat(stream: string): void {
    const heartbeatId = this.heartbeatIntervals.get(stream);
    if (heartbeatId) {
      clearInterval(heartbeatId);
      this.heartbeatIntervals.delete(stream);
      console.log(`💔 Heartbeat detenido para ${stream}`);
    }
  }

  closeStream(stream: string): void {
    const ws = this.wsConnections.get(stream);
    if (!ws) return;

    if (ws.readyState === WebSocket.OPEN) {
      console.log(`🔌 Cerrando stream: ${stream}`);
      this.stopHeartbeat(stream);

      const timeoutId = this.connectionTimeouts.get(stream);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.connectionTimeouts.delete(stream);
      }

      ws.close();
    }

    this.wsConnections.delete(stream);
    this.reconnectAttempts.delete(stream);
  }

  closeAllStreams(): void {
    console.log('🔌 Cerrando todas las conexiones WebSocket...');

    this.heartbeatIntervals.forEach((intervalId, stream) => {
      clearInterval(intervalId);
      console.log(`💔 Heartbeat detenido para ${stream}`);
    });
    this.heartbeatIntervals.clear();

    this.connectionTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    this.connectionTimeouts.clear();

    this.wsConnections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    this.wsConnections.clear();
    this.reconnectAttempts.clear();
  }

  private shouldReconnect(stream: string): boolean {
    const attempts = this.reconnectAttempts.get(stream) ?? 0;
    return attempts < this.maxReconnectAttempts;
  }

  private scheduleReconnect(stream: string, options: StreamOptions): void {
    if (!this.shouldReconnect(stream)) {
      console.warn(`⚠️  Reintentos agotados para ${stream}`);
      return;
    }

    const attempts = this.reconnectAttempts.get(stream) ?? 0;
    const delay = Math.min(this.reconnectDelay * 2 ** attempts, this.maxReconnectDelay);
    console.log(`🔄 Programando reconexión de ${stream} en ${delay}ms (intento ${attempts + 1})`);

    setTimeout(() => {
      this.reconnectAttempts.set(stream, attempts + 1);
      this.connectToStream(stream, options);
    }, delay);
  }

  getConnectionStatus(): Record<string, { readyState: number; isConnected: boolean; reconnectAttempts: number }> {
    const status: Record<string, { readyState: number; isConnected: boolean; reconnectAttempts: number }> = {};
    this.wsConnections.forEach((ws, stream) => {
      status[stream] = {
        readyState: ws.readyState,
        isConnected: ws.readyState === WebSocket.OPEN,
        reconnectAttempts: this.reconnectAttempts.get(stream) ?? 0
      };
    });
    return status;
  }

  getActiveConnectionsCount(): number {
    let count = 0;
    this.wsConnections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        count += 1;
      }
    });
    return count;
  }

  private emitErrorEvent(payload: WebSocketErrorPayload): void {
    if (this.listenerCount('error') > 0) {
      super.emit('error', payload);
    }
    super.emit('wsError', payload);
  }
}
