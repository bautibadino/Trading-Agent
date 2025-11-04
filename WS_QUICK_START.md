# 🚀 WebSocket AI Data - Inicio Rápido

## ¿Qué hace esto?

Captura **TODOS los datos disponibles** de Binance Futures en tiempo real para análisis con IA:

- ✅ Trades agregados con lado (buy/sell aggression)
- ✅ Mark Price, Index Price, Funding Rate
- ✅ Velas OHLCV con volumen taker
- ✅ Book ticker (best bid/ask, spread, imbalance)
- ✅ Order book depth (top 5 niveles)
- ✅ Liquidaciones
- ✅ Ticker 24h completo

## 🎯 Uso Rápido

```bash
# BTCUSDT (por defecto)
npm run ws:futures

# ETHUSDT  
npm run ws:futures:eth

# Cualquier otro símbolo
npm run build
node dist/scripts/ws-futures-ai.js --symbol=SOLUSDT --interval=5m
```

## 📺 Qué verás

### Eventos en Tiempo Real

Solo se muestran eventos importantes:

**🟢/🔴 Trades Grandes** (>$5,000)
```
🟢 [TRADE GRANDE] 2025-11-04T02:30:59.263Z
   Price: 3631.01 | Qty: 45.457000 | Volume: $165,054
   Side: BUY (taker) | Trade ID: 2557685064
```

**⚠️  Liquidaciones** (>$1,000)
```
⚠️  [LIQUIDACION] 2025-11-04T02:30:59.544Z
   Side: SELL | Status: FILLED
   💰 Avg Price: 3631.00
   📊 Qty: 2.500000
   💵 Value: $168,086
```

**🕯️  Velas Cerradas**
```
🕯️  [KLINE 1m CERRADA] 2025-11-04T02:30:59.526Z
   OHLC: O:3633.43 H:3633.43 L:3631.00 C:3631.00
   🔴 Change: -2.43 (-0.07%)
   📊 Volume: 2875.0970 ETH | Quote: $10,441,069
   🔥 Taker Buy: 1122.4990 (39.04%) | Trades: 4423
```

### 📊 Resumen Completo (cada minuto)

```
==========================================================================================
📊 RESUMEN COMPLETO - 2025-11-04T02:31:00.000Z
==========================================================================================

💹 PRECIO Y FUNDING:
   Precio Actual: 3631.00
   Mark Price: 3631.20 | Index Price: 3631.00
   Basis: 0.20 (0.0055%) 📈
   Funding Rate: 0.0100% (anualizado: 10.95%)

📊 ACTIVIDAD DE TRADING:
   Buy Volume: $1,250,430 (45.23%)
   Sell Volume: $1,513,890 (54.77%)
   Total Volume: $2,764,320
   Buy/Sell Ratio: 0.83
   Trades: 3,234 | Trades/min: 54 | Trades Grandes (>5000): 12

📖 LIBRO DE ÓRDENES:
   Best Bid: 3631.00 x 73.7590
   Best Ask: 3631.01 x 41.0750
   Mid Price: 3631.01 | Spread: 0.01 (0.0003%)
   Book Imbalance (top): 28.45% 🟢 (bid pressure)
   Depth Imbalance (top 5): 35.12%

📈 ESTADÍSTICAS 24H:
   Cambio 24h: +2.34%
   Volumen 24h: $2,543,234,567

⚠️  LIQUIDACIONES:
   Total Liquidaciones: 5

==========================================================================================
```

## ⚙️ Configuración

### Parámetros CLI

```bash
--symbol=BTCUSDT    # Símbolo a monitorear (default: BTCUSDT)
--interval=1m       # Intervalo de klines: 1m, 5m, 15m, 1h, etc (default: 1m)
--timeout=20000     # Timeout de conexión en ms (default: 20000)
```

### Ajustar Filtros

Edita `scripts/ws-futures-ai.ts`:

```typescript
const MIN_TRADE_TO_SHOW = 5000;       // Mínimo $5k para mostrar trade
const MIN_LIQUIDATION_TO_SHOW = 1000; // Mínimo $1k para mostrar liquidación
```

## 🧠 Para IA

### Datos Disponibles Cada Minuto

El resumen incluye todas estas features calculadas:

```typescript
{
  // Precio
  price: number,
  markPrice: number,
  indexPrice: number,
  basis: number,
  basisPercent: number,
  
  // Funding
  fundingRate: number,
  fundingRateAnnualized: number,
  
  // Volumen
  buyVolume: number,
  sellVolume: number,
  totalVolume: number,
  buySellRatio: number,
  buyPercent: number,
  sellPercent: number,
  
  // Trades
  totalTrades: number,
  tradesPerMinute: number,
  largeTradesCount: number,
  
  // Book
  bestBid: number,
  bestAsk: number,
  bestBidQty: number,
  bestAskQty: number,
  spread: number,
  spreadPercent: number,
  midPrice: number,
  bookImbalance: number,
  depthImbalance: number,
  
  // 24h
  change24h: number,
  volume24h: number,
  
  // Eventos
  liquidationCount: number
}
```

### Uso con Streaming

Para enviar datos a una IA en tiempo real:

```typescript
import { spawn } from 'child_process';

const ws = spawn('node', [
  'dist/scripts/ws-futures-ai.js',
  '--symbol=BTCUSDT'
]);

ws.stdout.on('data', (data) => {
  const output = data.toString();
  
  // Buscar resúmenes
  if (output.includes('RESUMEN COMPLETO')) {
    // Parsear y enviar a IA
    sendToAI(parseResumen(output));
  }
  
  // Buscar eventos importantes
  if (output.includes('[TRADE GRANDE]')) {
    sendToAI({ type: 'large_trade', data: parseTrade(output) });
  }
  
  if (output.includes('[LIQUIDACION]')) {
    sendToAI({ type: 'liquidation', data: parseLiquidation(output) });
  }
});
```

## 📝 Notas

- **Consola optimizada**: El bookTicker ya no llena la pantalla. Solo se acumula silenciosamente.
- **Resumen cada minuto**: Todas las métricas consolidadas en un solo lugar.
- **Solo eventos importantes**: Trades grandes, liquidaciones significativas, velas cerradas.
- **Todos los datos disponibles**: Aunque no todos se muestran, todos se capturan y están en el resumen.

## 🔧 Troubleshooting

### No veo ningún trade grande

Es normal si el mercado está tranquilo. El umbral es $5,000. Para ver más:
- Reduce `MIN_TRADE_TO_SHOW` en el código
- O simplemente espera al resumen cada minuto que muestra todo

### No veo liquidaciones

Las liquidaciones solo aparecen cuando suceden. En mercados estables puede no haber ninguna por horas.

### ¿Cómo guardo los datos?

```bash
# Guardar en archivo
npm run ws:futures > logs/market-data.log 2>&1

# O redirigir solo stdout
npm run ws:futures > logs/market-data.log
```

## 🎓 Recursos

- [Binance Futures WebSocket Docs](https://binance-docs.github.io/apidocs/futures/en/)
- [AI_DATA_STREAMS.md](./AI_DATA_STREAMS.md) - Documentación completa
- [WEBSOCKET.md](./docs/WEBSOCKET.md) - Guía técnica del WebSocketService

---

**Tip:** Para análisis con IA, deja correr el script y analiza los resúmenes cada minuto. Contienen todas las métricas necesarias para detectar patrones, momentum, y oportunidades de trading.

