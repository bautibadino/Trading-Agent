/**
 * Punto de entrada del paquete.
 * Exporta los clientes listos para usar en otros proyectos o scripts locales.
 */
export { BinanceClient } from './services/BinanceClient.js';
export { WebSocketService } from './services/WebSocketService.js';
export type { StreamOptions, WebSocketErrorPayload } from './services/WebSocketService.js';
export { Candle } from './models/Candle.js';
export type { CandleJSON } from './models/Candle.js';
export { Trade } from './models/Trade.js';
export type { TradeJSON } from './models/Trade.js';

export { ScalpingPullbackStrategy } from './strategies/ScalpingPullbackStrategy.js';
export type { StrategyConfig, StrategyEvent, EntryEvent, ExitEvent } from './strategies/ScalpingPullbackStrategy.js';
