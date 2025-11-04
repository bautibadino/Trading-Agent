# 🤖 Sistema de Logs para IA - Resumen Ejecutivo

## ✨ Qué Hace

Captura **datos completos de Binance Futures** en tiempo real y los guarda en archivos JSON organizados por timeframe, listos para alimentar agentes de IA.

## 🚀 Inicio en 30 Segundos

```bash
# 1. Compilar
npm run build

# 2. Capturar datos en 5 minutos
npm run ws:futures:5m

# 3. Ver los datos (en otra terminal)
npm run logs -- --timeframe=5m --stats
```

**Archivo generado**: `logs/5m/market-data-BTCUSDT-2025-11-04.jsonl`

## 📊 Qué Incluye Cada JSON

```json
{
  "ts": "timestamp",
  "symbol": "ETHUSDT",
  "lastPrice": 3647.78,
  
  "orderbook": {
    "spread": 0.01,
    "imbalance": 0.99,      // Presión bid/ask
    "microprice": 3647.8    // Precio ponderado
  },
  
  "micro_flow": {
    "takerBuyRatio": 0.5    // 0=venta, 1=compra
  },
  
  "indicators": {
    "rsi14": 67.34,         // 0-100
    "ema9": 3636.82,        // Media rápida
    "ema21": 3633.01,       // Media lenta
    "volatility": 0.02      // 2% volatilidad
  },
  
  "heuristics": {
    "ema9Above21": true,    // Tendencia alcista?
    "rsiState": "neutral",  // oversold/neutral/overbought
    "buyPressure": false    // Compradores dominan?
  },
  
  "market_stats": {
    "fundingRate": 0.0001,
    "volume24h": 150000000,
    "liquidationVolume": 150000
  }
}
```

## 📁 Timeframes Disponibles

| Comando | Timeframe | Datos/Día | Uso |
|---------|-----------|-----------|-----|
| `npm run ws:futures:1m` | 1 minuto | 1,440 | Scalping, alertas |
| `npm run ws:futures:5m` | 5 minutos | 288 | Trading intraday |
| `npm run ws:futures:15m` | 15 minutos | 96 | Swing intraday |
| `npm run ws:futures:30m` | 30 minutos | 48 | Análisis medio |
| `npm run ws:futures:1h` | 1 hora | 24 | Visión macro |
| `npm run ws:futures:4h` | 4 horas | 6 | Tendencias largas |

## 🎯 Modo Profesional: Todos los Timeframes

```bash
# Iniciar captura en TODOS los timeframes
npm run start:all

# Resultado: 6 procesos en background capturando datos
# - logs/1m/market-data-BTCUSDT-2025-11-04.jsonl
# - logs/5m/market-data-BTCUSDT-2025-11-04.jsonl
# - logs/15m/market-data-BTCUSDT-2025-11-04.jsonl
# - logs/30m/market-data-BTCUSDT-2025-11-04.jsonl
# - logs/1h/market-data-BTCUSDT-2025-11-04.jsonl
# - logs/4h/market-data-BTCUSDT-2025-11-04.jsonl

# Detener todo
npm run stop:all
```

## 🧠 Ejemplo de Uso con IA

```python
import json

# Leer último dato de 5m
with open('logs/5m/market-data-BTCUSDT-2025-11-04.jsonl', 'r') as f:
    latest = json.loads(f.readlines()[-1])

# Decisión simple
if (latest['heuristics']['ema9Above21'] and 
    latest['heuristics']['buyPressure'] and
    latest['indicators']['rsi14'] < 70):
    print("✅ LONG - Tendencia alcista con presión compradora")
    print(f"Precio: ${latest['lastPrice']:,.2f}")
    print(f"RSI: {latest['indicators']['rsi14']:.1f}")
else:
    print("❌ SIN SEÑAL")
```

## 📚 Documentación

| Archivo | Contenido |
|---------|-----------|
| **`QUICK_START_AI.md`** | ⭐ Inicio rápido y ejemplos básicos |
| **`AI_LOGS_GUIDE.md`** | 📖 Guía completa con código Python y estrategias |
| **`LOGS_STRUCTURE.md`** | 🔧 Detalles técnicos de la estructura |
| **`WS_QUICK_START.md`** | 🌐 Guía de WebSocket |

## ✅ Features Principales

- ✅ **Indicadores pre-inicializados**: RSI, EMAs listos desde el primer JSON
- ✅ **Volatilidad calculada**: Desviación estándar de retornos
- ✅ **Micro flow**: Presión compradora/vendedora del período
- ✅ **Multiprice**: Precio ponderado por cantidades del libro
- ✅ **Market stats**: Funding rate, liquidaciones, stats 24h
- ✅ **Organizado**: Logs por timeframe en carpetas separadas
- ✅ **Formato JSONL**: Un JSON por línea, fácil de procesar

## 🎯 Casos de Uso

1. **Entrenamiento de IA**: Histórico completo con features calculadas
2. **Trading Algorítmico**: Señales en tiempo real
3. **Backtesting**: Datos reales con todos los indicadores
4. **Análisis**: Pandas/DataFrame friendly
5. **Alertas**: Monitoreo de condiciones específicas

## 💡 Próximos Pasos

1. Lee [`QUICK_START_AI.md`](./QUICK_START_AI.md)
2. Ejecuta `npm run ws:futures:5m`
3. Espera 5 minutos
4. Lee los datos con `npm run logs`
5. Integra con tu IA favorita

---

**Sistema listo para producción** 🚀

