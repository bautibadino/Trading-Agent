# 🤖 AI Data Streams - Documentación Completa

Este documento explica cómo usar los modos de captura completa de datos de Binance, diseñados para proporcionar TODA la información disponible a modelos de IA.

## 🎯 Características

### Datos Capturados en Tiempo Real

Los nuevos modos capturan **7 streams simultáneamente**:

1. **aggTrade** - Trades Agregados
   - Precio, cantidad, volumen
   - Lado (comprador/vendedor agresivo)
   - IDs de trade agregados
   - Acumulación de volumen buy/sell

2. **markPrice@1s** - Mark Price y Funding
   - Mark Price (precio de marca)
   - Index Price (precio índice)
   - Funding Rate (tasa de financiamiento)
   - Basis (diferencia mark-index)
   - Próximo horario de funding
   - Estimated Settle Price

3. **kline_1m** - Velas OHLCV
   - Open, High, Low, Close
   - Volumen base y quote
   - Volumen taker buy (presión compradora)
   - Número de trades
   - Estado de la vela (cerrada/en progreso)

4. **ticker** - Ticker 24h Completo
   - Cambio de precio 24h (absoluto y porcentual)
   - High/Low/Open del período
   - Weighted Average Price
   - Volumen total 24h
   - Número de trades 24h

5. **bookTicker** - Mejor Bid/Ask
   - Mejor precio bid y cantidad
   - Mejor precio ask y cantidad
   - Spread (diferencia bid-ask)
   - Mid price
   - Imbalance del libro (presión bid/ask)

6. **depth5@100ms** - Order Book Top 5
   - Top 5 niveles de bids
   - Top 5 niveles de asks
   - Imbalance de profundidad
   - Valores en USD de cada nivel

7. **forceOrder** - Liquidaciones
   - Lado (BUY/SELL)
   - Precio y precio promedio
   - Cantidades (original, filled, last fill)
   - Valor en USD
   - Estado y timing

## 🚀 Uso

### Opción 1: Script para Binance FUTURES (Recomendado) ⭐

Este script usa la API de **Binance Futures** que incluye mark price, funding rate y liquidaciones.

**Características optimizadas v2.0:**
- ✅ Consola limpia y legible (sin spam de bookTicker)
- ✅ Solo muestra eventos importantes: trades grandes (>$5k), liquidaciones (>$1k), velas cerradas
- ✅ Resumen completo cada 60 segundos con TODAS las métricas
- ✅ Acumula datos silenciosamente para el resumen
- ✅ Perfecto para monitoreo continuo y análisis por IA

```bash
# BTCUSDT (por defecto)
npm run ws:futures

# ETHUSDT
npm run ws:futures:eth

# Cualquier otro símbolo
npm run build
npx node@22 --dns-result-order=ipv4first dist/scripts/ws-futures-ai.js --symbol=SOLUSDT

# Con intervalo personalizado
npx node@22 --dns-result-order=ipv4first dist/scripts/ws-futures-ai.js --symbol=BTCUSDT --interval=5m
```

**Lo que verás en consola:**
- 🟢/🔴 Trades grandes en tiempo real (>$5,000)
- ⚠️  Liquidaciones importantes (>$1,000)
- 🕯️  Velas cerradas con estadísticas completas
- 📊 **Resumen completo cada minuto** con:
  - Precio, Mark Price, Index Price, Basis
  - Funding Rate (actual y anualizado)
  - Volumen acumulado (buy/sell ratio)
  - Estado del libro de órdenes (spread, imbalance)
  - Estadísticas 24h
  - Contador de liquidaciones

### Opción 2: Modo AI-Data en ws-listener

Para usar con el WebSocketService existente (Spot):

```bash
# Modo full/ai-data
npm run ws:full

# Con símbolo específico
npm run build
node dist/scripts/ws-listener.js --stream=ai-data --symbol=ETHUSDT --interval=5m
```

## 📊 Salida del Stream

### Formato de Logs

Cada stream imprime información detallada con:
- ✅ Emojis de colores para fácil identificación
- 🕒 Timestamps ISO 8601
- 📈 Métricas calculadas en tiempo real
- 💹 Ratios y porcentajes
- 🎯 Valores acumulados

### Ejemplo de Salida

```
🟢 [AGGTRADE] 2025-11-04T12:34:56.789Z
   Price: 67234.50 | Qty: 0.154000 | Volume: $10354.11
   Side: BUY (taker) | Trade ID: 123456 | First: 123455 | Last: 123457
   📈 Acumulado - Buy: $125430.45 | Sell: $98234.12 | Ratio: 1.28

💰 [MARK PRICE] 2025-11-04T12:34:56.789Z
   Mark Price: 67235.20 | Index Price: 67234.80
   Basis: 0.40 (0.0006%) 📈 Premium
   Funding Rate: 0.0100% | Next Funding: 2025-11-04T16:00:00.000Z

🕯️  [KLINE 1m] 2025-11-04T12:34:56.789Z ✅ CLOSED
   OHLC: O:67200.00 H:67250.00 L:67180.00 C:67234.50
   🟢 Change: 34.50 (0.05%)
   📊 Volume: 12.5430 BTC | Quote: $843234.12
   🔥 Taker Buy: 7.8234 (62.35%) | Quote: $525891.45
   📈 Trades: 234 | Period: 2025-11-04T12:34:00.000Z -> 2025-11-04T12:35:00.000Z

📖 [BOOK TICKER] 2025-11-04T12:34:56.789Z
   🟢 Best Bid: 67234.00 x 1.234000
   🔴 Best Ask: 67235.00 x 0.987000
   💫 Mid Price: 67234.50 | Spread: 1.00 (0.0015%)
   🟢 Imbalance: 11.23% (más bids)
   🔢 Update ID: 987654321

⚠️  [LIQUIDATION #1] 2025-11-04T12:34:56.789Z
   🔴 Side: SELL | Type: LIMIT | Status: FILLED
   💰 Price: 67234.50 | Avg Price: 67234.50
   📊 Qty: 2.500000 | Filled: 2.500000 | Last Fill: 2.500000
   💵 Value: $168086.25
   ⏰ Trade Time: 2025-11-04T12:34:56.789Z | TIF: IOC
```

### Resumen Periódico (cada 30s)

```
================================================================================
📊 RESUMEN - 2025-11-04T12:35:00.000Z
================================================================================
💹 Precio Actual: 67234.50
💰 Mark Price: 67235.20 | Index: 67234.80
💸 Funding Rate: 0.0100%
📈 Trades: 1234 | Buy Volume: $2543234.12 | Sell Volume: $1987654.32
🔥 Buy/Sell Ratio: 1.28
📖 Best Bid: 67234.00 | Best Ask: 67235.00 | Spread: 1.00
📊 Book Imbalance: 11.23%
⚠️  Liquidaciones: 3
================================================================================
```

## 🧠 Uso para IA

### Features Disponibles por Stream

#### 1. Análisis de Agresión (aggTrade)
- Volumen de compras vs ventas
- Ratio buy/sell como indicador de sentimiento
- Velocidad de trades (trades/segundo)
- Tamaño promedio de trade

#### 2. Análisis de Funding (markPrice)
- Funding rate como indicador de sentimiento
- Basis (premium/discount) del perp vs spot
- Divergencias mark-index
- Predicción de movimientos por funding

#### 3. Análisis de Momentum (kline)
- OHLCV tradicional
- Taker buy percentage (presión compradora)
- Velocidad de cambio de precio
- Patrón de velas

#### 4. Análisis de Contexto (ticker)
- Posición del precio en rango 24h
- Volumen comparado con histórico
- Weighted average price como referencia

#### 5. Microestructura (bookTicker + depth)
- Spread como indicador de liquidez
- Imbalance del libro (presión de órdenes)
- Cambios en best bid/ask
- Profundidad del libro en top 5 niveles

#### 6. Eventos de Riesgo (forceOrder)
- Detección de liquidaciones en cascada
- Lado de las liquidaciones (stress direction)
- Volumen de liquidaciones
- Clusters de liquidaciones

### Sugerencias de Features Calculadas

```typescript
// Ejemplo de features derivadas
interface AIFeatures {
  // Precio
  price: number;
  markPrice: number;
  indexPrice: number;
  basis: number;
  basisPercent: number;
  
  // Volumen y Agresión
  buyVolume: number;
  sellVolume: number;
  buySellRatio: number;
  takerBuyPercent: number;
  
  // Funding
  fundingRate: number;
  nextFundingTime: number;
  
  // Microestructura
  spread: number;
  spreadPercent: number;
  midPrice: number;
  bookImbalance: number;
  depthImbalance: number;
  
  // Liquidez
  bestBid: number;
  bestAsk: number;
  bestBidQty: number;
  bestAskQty: number;
  
  // Momentum
  priceChange24h: number;
  priceChangePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  trades24h: number;
  
  // Eventos
  liquidationCount: number;
  liquidationVolume: number;
  
  // Vela actual
  candleOpen: number;
  candleHigh: number;
  candleLow: number;
  candleClose: number;
  candleVolume: number;
  candleTakerBuyPercent: number;
}
```

## ⚙️ Configuración

### Parámetros CLI

- `--symbol=BTCUSDT`: Símbolo a monitorear (default: BTCUSDT)
- `--interval=1m`: Intervalo de klines (default: 1m)
  - Valores: 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M
- `--timeout=20000`: Timeout de conexión en ms (default: 20000)

### Símbolos Soportados

Cualquier par de futuros perpetuos de Binance:
- BTCUSDT
- ETHUSDT
- BNBUSDT
- SOLUSDT
- ADAUSDT
- DOGEUSDT
- etc.

## 🔧 Troubleshooting

### Error de Conexión

Si ves `ERR_SOCKET_CONNECTION_TIMEOUT`:
```bash
# Aumenta el timeout
npx node@22 --dns-result-order=ipv4first dist/scripts/ws-futures-ai.js --timeout=30000
```

### No recibo datos de forceOrder

Las liquidaciones solo aparecen cuando ocurren. Si no ves ninguna:
- Es normal en mercados estables
- Prueba con un símbolo más volátil (DOGE, SHIB, etc.)
- Espera a períodos de alta volatilidad

### Los datos parecen lentos

- markPrice: actualiza cada 1 segundo
- ticker: actualiza cada 2 segundos
- depth: actualiza cada 100ms
- aggTrade, bookTicker: tiempo real (<100ms)

## 📝 Notas Importantes

1. **API de Futures vs Spot**: El script `ws-futures-ai.ts` usa la API de Futures (fstream.binance.com) que es diferente a la API de Spot. Mark price, funding rate y liquidaciones solo están disponibles en Futures.

2. **Rate Limits**: Binance tiene límites de conexiones WebSocket:
   - Max 10 conexiones por IP
   - Max 1024 streams por conexión (estamos usando 7, ok ✅)

3. **Consumo de Recursos**: Este modo imprime MUCHA información. Para uso en producción considera:
   - Guardar en archivo en lugar de console.log
   - Filtrar solo eventos importantes
   - Agregar datos en ventanas de tiempo

4. **Colores**: Los colores requieren terminal compatible con ANSI. En producción/logs considera desactivar chalk.

## 🎓 Referencias

- [Binance Futures WebSocket Docs](https://binance-docs.github.io/apidocs/futures/en/)
- [Binance Spot WebSocket Docs](https://github.com/binance/binance-spot-api-docs/blob/master/web-socket-streams.md)
- Trading Signals Library: [trading-signals npm](https://www.npmjs.com/package/trading-signals)

## 🚀 Próximos Pasos

Ideas para extender:
1. Guardar datos en base de datos (SQLite, PostgreSQL)
2. Calcular indicadores técnicos en tiempo real (RSI, MACD, etc.)
3. Detectar patrones (support/resistance, breakouts)
4. Agregar más símbolos simultáneamente
5. Integrar con modelos de ML/IA
6. API REST para consultar datos acumulados
7. Dashboard web en tiempo real

