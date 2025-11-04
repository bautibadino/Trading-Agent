# 🤖 Quick Start - Sistema de Logs para IA

## 🎯 Inicio Rápido

### Opción 1: Capturar UN Timeframe

```bash
# 5 minutos (recomendado para empezar)
npm run ws:futures:5m

# 1 minuto (más datos)
npm run ws:futures:1m

# 1 hora (visión macro)
npm run ws:futures:1h
```

### Opción 2: Capturar TODOS los Timeframes (Mejor para IA)

```bash
# Iniciar todos (1m, 5m, 15m, 30m, 1h, 4h)
npm run start:all

# O con ETHUSDT
./scripts/start-all-timeframes.sh ETHUSDT

# Detener todos
npm run stop:all
```

## 📂 Dónde Están los Datos

```
logs/
├── 1m/market-data-BTCUSDT-2025-11-04.jsonl
├── 5m/market-data-BTCUSDT-2025-11-04.jsonl
├── 15m/market-data-BTCUSDT-2025-11-04.jsonl
├── 30m/market-data-BTCUSDT-2025-11-04.jsonl
├── 1h/market-data-BTCUSDT-2025-11-04.jsonl
└── 4h/market-data-BTCUSDT-2025-11-04.jsonl
```

## 📊 Qué Contiene Cada JSON

```json
{
  "ts": "2025-11-04T03:15:28.029Z",
  "symbol": "ETHUSDT",
  "lastPrice": 3647.78,
  "orderbook": {
    "bestBid": { "p": 3647.79, "q": 118.69 },
    "bestAsk": { "p": 3647.8, "q": 0.53 },
    "mid": 3647.8,
    "spread": 0.01,
    "spreadBps": 0.03,
    "imbalance": 0.99,
    "microprice": 3647.8
  },
  "micro_flow": {
    "takerBuyQuote": 9358335.56,
    "takerSellQuote": 9232658.95,
    "takerBuyRatio": 0.5
  },
  "indicators": {
    "rsi14": 67.34,
    "sma20": 3631.74,
    "ema9": 3636.82,
    "ema21": 3633.01,
    "volatility": 0.02
  },
  "heuristics": {
    "ema9Above21": true,
    "rsiState": "neutral",
    "buyPressure": false
  },
  "market_stats": {
    "fundingRate": 0.0001,
    "indexPrice": 3647.75,
    "volume24h": 150000000,
    "high24h": 3700.00,
    "low24h": 3600.00,
    "openInterest": null,
    "liquidationVolume": 150000
  }
}
```

## 🔍 Ver los Datos

### Opción 1: Terminal

```bash
# Ver último registro
npm run logs

# Ver últimos 5 registros
npm run logs -- --last=5

# Ver estadísticas
npm run logs -- --stats

# Timeframe específico
npm run logs -- --timeframe=5m --symbol=ETHUSDT --last=3
```

### Opción 2: Tiempo Real

```bash
# Ver JSONs en tiempo real con formato bonito
tail -f logs/5m/market-data-BTCUSDT-2025-11-04.jsonl | jq '.'

# Solo ver RSI
tail -f logs/1m/market-data-BTCUSDT-2025-11-04.jsonl | jq '.indicators.rsi14'

# Ver cuando hay presión compradora
tail -f logs/1m/market-data-BTCUSDT-2025-11-04.jsonl | jq 'select(.heuristics.buyPressure == true)'
```

## 🧠 Usar con IA

### Ejemplo Simple (Python)

```python
import json

# Leer último dato
with open('logs/5m/market-data-BTCUSDT-2025-11-04.jsonl', 'r') as f:
    lines = f.readlines()
    latest = json.loads(lines[-1])

# Análisis básico
if latest['heuristics']['ema9Above21'] and latest['heuristics']['buyPressure']:
    print("✅ SEÑAL ALCISTA")
    print(f"Precio: ${latest['lastPrice']:,.2f}")
    print(f"RSI: {latest['indicators']['rsi14']:.1f}")
else:
    print("❌ SIN SEÑAL")
```

### Multi-Timeframe

```python
def get_multi_tf_context():
    """Obtiene contexto de múltiples timeframes"""
    data = {}
    for tf in ['1m', '5m', '15m', '1h']:
        path = f'logs/{tf}/market-data-BTCUSDT-2025-11-04.jsonl'
        with open(path, 'r') as f:
            lines = f.readlines()
            data[tf] = json.loads(lines[-1])
    return data

ctx = get_multi_tf_context()

# ¿Todos los TFs alcistas?
all_bullish = all(d['heuristics']['ema9Above21'] for d in ctx.values())
print(f"Alineación alcista: {all_bullish}")
```

## 📈 Features Clave

✅ **Orderbook**: Spread, imbalance, microprice  
✅ **Micro Flow**: Presión compradora/vendedora por período  
✅ **Indicadores**: RSI, SMA, EMAs, Volatilidad  
✅ **Heurísticas**: Señales simples pre-calculadas  
✅ **Market Stats**: Funding, 24h stats, liquidaciones  
✅ **Multi-Timeframe**: 6 timeframes simultáneos  
✅ **Histórico**: Indicadores inicializados con datos históricos  

## 🎓 Documentación Completa

- **`AI_LOGS_GUIDE.md`**: Ejemplos de uso con IA, estrategias, código
- **`LOGS_STRUCTURE.md`**: Estructura técnica y formato
- **`WS_QUICK_START.md`**: Guía básica de WebSocket

## ⚡ Tips

1. **Para desarrollo**: Usa `1m` para ver resultados rápido
2. **Para producción**: Combina `5m` + `1h` + `4h`
3. **Para backtesting**: Lee los archivos `.jsonl` completos
4. **Para alertas**: Monitorea `1m` en tiempo real
5. **Para análisis**: Usa `logs` command con `--stats`

---

**¿Dudas?** Lee `AI_LOGS_GUIDE.md` para ejemplos completos con código.

