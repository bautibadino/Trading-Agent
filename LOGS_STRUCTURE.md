# 📁 Estructura de Logs - Trading Bot

## 🗂️ Organización por Timeframe

Los logs se organizan automáticamente en carpetas según el timeframe:

```
logs/
├── 1m/
│   ├── market-data-BTCUSDT-2025-11-04.jsonl
│   ├── market-data-ETHUSDT-2025-11-04.jsonl
│   └── market-data-SOLUSDT-2025-11-04.jsonl
├── 5m/
│   ├── market-data-BTCUSDT-2025-11-04.jsonl
│   └── market-data-ETHUSDT-2025-11-04.jsonl
├── 15m/
│   └── market-data-BTCUSDT-2025-11-04.jsonl
├── 30m/
│   └── market-data-BTCUSDT-2025-11-04.jsonl
├── 1h/
│   └── market-data-BTCUSDT-2025-11-04.jsonl
└── 4h/
    └── market-data-BTCUSDT-2025-11-04.jsonl
```

## 🚀 Comandos Disponibles

### Por Timeframe

```bash
# 1 minuto (por defecto)
npm run ws:futures:1m

# 5 minutos
npm run ws:futures:5m

# 15 minutos
npm run ws:futures:15m

# 30 minutos
npm run ws:futures:30m

# 1 hora
npm run ws:futures:1h

# 4 horas
npm run ws:futures:4h
```

### Con Símbolo Personalizado

```bash
# ETHUSDT en 5 minutos
npm run build
node dist/scripts/ws-futures-ai.js --symbol=ETHUSDT --interval=5m

# SOLUSDT en 1 hora
npm run build
node dist/scripts/ws-futures-ai.js --symbol=SOLUSDT --interval=1h
```

## 📊 Formato de Datos

### Estructura del JSON

Cada línea del archivo `.jsonl` contiene un JSON completo:

```json
{
  "ts": "2025-11-04T03:15:00.000Z",
  "symbol": "BTCUSDT",
  "lastPrice": 106370.5,
  "orderbook": {
    "bestBid": { "p": 106370.4, "q": 5.25 },
    "bestAsk": { "p": 106370.5, "q": 3.18 },
    "mid": 106370.45,
    "spread": 0.1,
    "spreadBps": 0.01,
    "imbalance": 0.25,
    "microprice": 106370.47
  },
  "micro_flow": {
    "takerBuyQuote": 1250000.50,
    "takerSellQuote": 980000.25,
    "takerBuyRatio": 0.56
  },
  "indicators": {
    "rsi14": 52.3,
    "sma20": 106350.2,
    "ema9": 106365.8,
    "ema21": 106355.1
  },
  "heuristics": {
    "ema9Above21": true,
    "rsiState": "neutral",
    "buyPressure": true
  }
}
```

### Campos Explicados

#### 📍 Información Básica
- `ts`: Timestamp ISO 8601
- `symbol`: Par de trading (BTCUSDT, ETHUSDT, etc.)
- `lastPrice`: Último precio del trade

#### 📖 Order Book
- `bestBid`: Mejor precio de compra y cantidad
- `bestAsk`: Mejor precio de venta y cantidad
- `mid`: Precio medio (bid + ask) / 2
- `spread`: Diferencia entre ask y bid
- `spreadBps`: Spread en basis points (1 bp = 0.01%)
- `imbalance`: Balance entre cantidad bid/ask (-1 a 1)
- `microprice`: Precio ponderado por cantidades del libro

#### 🌊 Micro Flow (Flujo del Período)
- `takerBuyQuote`: Volumen de compras agresivas en USD
- `takerSellQuote`: Volumen de ventas agresivas en USD
- `takerBuyRatio`: Ratio buy/total (0 a 1)

#### 📈 Indicadores Técnicos
- `rsi14`: RSI de 14 períodos (0-100)
- `sma20`: Media móvil simple de 20 períodos
- `ema9`: Media móvil exponencial de 9 períodos
- `ema21`: Media móvil exponencial de 21 períodos

#### 🎯 Heurísticas
- `ema9Above21`: Si EMA(9) > EMA(21) (tendencia alcista)
- `rsiState`: "oversold" (<30), "neutral" (30-70), "overbought" (>70)
- `buyPressure`: Si takerBuyRatio > 0.55

## 🔄 Frecuencia de Emisión

| Timeframe | Emisión | Registros/Hora | Registros/Día |
|-----------|---------|----------------|---------------|
| 1m        | 60s     | 60             | 1,440         |
| 5m        | 300s    | 12             | 288           |
| 15m       | 900s    | 4              | 96            |
| 30m       | 1800s   | 2              | 48            |
| 1h        | 3600s   | 1              | 24            |
| 4h        | 14400s  | 0.25           | 6             |

## 📖 Leer y Procesar Logs

### Con jq (línea de comandos)

```bash
# Ver último registro
tail -1 logs/1m/market-data-BTCUSDT-2025-11-04.jsonl | jq '.'

# Extraer solo RSI
cat logs/1m/market-data-BTCUSDT-2025-11-04.jsonl | jq '.indicators.rsi14'

# Filtrar por RSI > 70 (sobrecompra)
cat logs/1m/market-data-BTCUSDT-2025-11-04.jsonl | jq 'select(.indicators.rsi14 > 70)'

# Contar registros
wc -l logs/1m/market-data-BTCUSDT-2025-11-04.jsonl
```

### Con Python

```python
import json
from pathlib import Path

def read_market_data(timeframe='1m', symbol='BTCUSDT', date='2025-11-04'):
    """Lee datos de mercado de un archivo de log"""
    file_path = Path(f'logs/{timeframe}/market-data-{symbol}-{date}.jsonl')
    
    data = []
    with open(file_path, 'r') as f:
        for line in f:
            if line.strip():
                data.append(json.loads(line))
    
    return data

# Usar
data = read_market_data(timeframe='5m', symbol='BTCUSDT')
print(f"Total registros: {len(data)}")

# Analizar RSI
rsi_values = [d['indicators']['rsi14'] for d in data if d['indicators']['rsi14']]
print(f"RSI promedio: {sum(rsi_values) / len(rsi_values):.2f}")

# Detectar momentum alcista
bullish_count = sum(1 for d in data if d['heuristics']['ema9Above21'] and d['heuristics']['buyPressure'])
print(f"Períodos alcistas: {bullish_count}/{len(data)}")
```

### Con Node.js

```javascript
import { readFileSync } from 'fs';
import { join } from 'path';

function readMarketData(timeframe = '1m', symbol = 'BTCUSDT', date = '2025-11-04') {
  const filePath = join('logs', timeframe, `market-data-${symbol}-${date}.jsonl`);
  
  const content = readFileSync(filePath, 'utf-8');
  return content
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

// Usar
const data = readMarketData('5m', 'BTCUSDT');
console.log(`Total registros: ${data.length}`);

// Calcular presión compradora promedio
const avgBuyPressure = data.reduce((sum, d) => sum + d.micro_flow.takerBuyRatio, 0) / data.length;
console.log(`Presión compradora promedio: ${(avgBuyPressure * 100).toFixed(2)}%`);
```

## 🤖 Uso con Agentes de IA

### Contexto para LLM

```python
def get_market_context(timeframe='5m', symbol='BTCUSDT', last_n=10):
    """Obtiene contexto reciente del mercado para el agente"""
    data = read_market_data(timeframe, symbol)
    recent = data[-last_n:]  # Últimos N registros
    
    context = {
        'timeframe': timeframe,
        'symbol': symbol,
        'current_price': recent[-1]['lastPrice'],
        'price_trend': 'up' if recent[-1]['lastPrice'] > recent[0]['lastPrice'] else 'down',
        'rsi': recent[-1]['indicators']['rsi14'],
        'trend': 'bullish' if recent[-1]['heuristics']['ema9Above21'] else 'bearish',
        'buy_pressure': recent[-1]['micro_flow']['takerBuyRatio'],
        'spread_bps': recent[-1]['orderbook']['spreadBps'],
        'recent_data': recent
    }
    
    return context

# Prompt para IA
context = get_market_context('5m', 'BTCUSDT', last_n=12)  # Última hora en 5m
prompt = f"""
Analiza la situación del mercado:
- Símbolo: {context['symbol']}
- Timeframe: {context['timeframe']}
- Precio actual: ${context['current_price']:,.2f}
- RSI(14): {context['rsi']:.1f}
- Tendencia: {context['trend']}
- Presión compradora: {context['buy_pressure']:.2%}

Basándote en los últimos {len(context['recent_data'])} períodos, ¿qué operación recomendarías?
"""
```

## 🔧 Mantenimiento

### Limpieza de Logs Antiguos

```bash
# Eliminar logs de hace más de 7 días
find logs/ -name "*.jsonl" -mtime +7 -delete

# Comprimir logs antiguos
find logs/ -name "*.jsonl" -mtime +1 -exec gzip {} \;
```

### Espacio en Disco

Estimación de espacio por día:

| Timeframe | Tamaño/Registro | Registros/Día | Total/Día |
|-----------|-----------------|---------------|-----------|
| 1m        | ~500 bytes      | 1,440         | ~700 KB   |
| 5m        | ~500 bytes      | 288           | ~140 KB   |
| 15m       | ~500 bytes      | 96            | ~48 KB    |
| 30m       | ~500 bytes      | 48            | ~24 KB    |
| 1h        | ~500 bytes      | 24            | ~12 KB    |
| 4h        | ~500 bytes      | 6             | ~3 KB     |

**Total para todos los timeframes**: ~927 KB/día por símbolo

## 📝 Notas

1. **Formato JSONL**: Un JSON por línea facilita el procesamiento streaming
2. **Archivos diarios**: Cada día se crea un nuevo archivo automáticamente
3. **Carpetas automáticas**: Las carpetas se crean automáticamente si no existen
4. **Indicadores inicializados**: Los indicadores se precargan con datos históricos al inicio
5. **Sin pérdida de datos**: Cada emisión se guarda inmediatamente en disco

## 🎯 Best Practices

1. **Procesar por chunks**: Para archivos grandes, lee línea por línea
2. **Usar índices temporales**: Crea índices por timestamp si necesitas búsquedas frecuentes
3. **Backup regular**: Respalda la carpeta `logs/` periódicamente
4. **Monitorear espacio**: Implementa rotación de logs si guardas muchos símbolos
5. **Validar JSON**: Siempre valida el JSON antes de procesarlo

## 🚨 Troubleshooting

**Problema**: No se crean los archivos
- Verifica permisos de escritura en la carpeta `logs/`
- Revisa que el script esté corriendo correctamente

**Problema**: Indicadores en `null`
- Espera al menos 1 período para que se inicialicen
- Verifica conectividad con Binance API

**Problema**: Archivo muy grande
- Implementa rotación de logs
- Comprime archivos antiguos con `gzip`

---

**Documentación actualizada**: 2025-11-04
**Versión**: 2.0

