# 🤖 Guía de Logs para Agentes de IA

## 📊 JSON Completo con Market Data

Cada minuto/período se genera un JSON con TODA la información del mercado:

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

## 🚀 Inicio Rápido

### Opción 1: Un Solo Timeframe

```bash
# BTCUSDT en 5 minutos
npm run ws:futures:5m

# ETHUSDT en 1 hora
npm run build
node dist/scripts/ws-futures-ai.js --symbol=ETHUSDT --interval=1h
```

### Opción 2: TODOS los Timeframes (Recomendado para IA)

```bash
# Iniciar todos los timeframes para BTCUSDT
./scripts/start-all-timeframes.sh BTCUSDT

# O para ETHUSDT
./scripts/start-all-timeframes.sh ETHUSDT

# Detener todos
./scripts/stop-all-timeframes.sh BTCUSDT
```

## 📁 Estructura de Archivos

```
logs/
├── 1m/market-data-BTCUSDT-2025-11-04.jsonl   (1,440 registros/día)
├── 5m/market-data-BTCUSDT-2025-11-04.jsonl   (288 registros/día)
├── 15m/market-data-BTCUSDT-2025-11-04.jsonl  (96 registros/día)
├── 30m/market-data-BTCUSDT-2025-11-04.jsonl  (48 registros/día)
├── 1h/market-data-BTCUSDT-2025-11-04.jsonl   (24 registros/día)
└── 4h/market-data-BTCUSDT-2025-11-04.jsonl   (6 registros/día)
```

## 📖 Campos del JSON

### 🔍 Información Básica
- **ts**: Timestamp ISO 8601
- **symbol**: Par de trading
- **lastPrice**: Último precio de trade

### 📖 Order Book (Libro de Órdenes)
- **bestBid**: Mejor precio/cantidad de compra
- **bestAsk**: Mejor precio/cantidad de venta
- **mid**: Precio medio `(bid + ask) / 2`
- **spread**: Diferencia `ask - bid`
- **spreadBps**: Spread en basis points (1 bp = 0.01%)
- **imbalance**: Balance de cantidades `(bidQty - askQty) / (bidQty + askQty)`
  - `> 0`: Más bids (presión compradora)
  - `< 0`: Más asks (presión vendedora)
  - `~0`: Equilibrado
- **microprice**: Precio ponderado por cantidades `(bid*askQty + ask*bidQty) / (bidQty + askQty)`

### 🌊 Micro Flow (Flujo del Período)
- **takerBuyQuote**: Volumen de compras agresivas en USD del período
- **takerSellQuote**: Volumen de ventas agresivas en USD del período
- **takerBuyRatio**: Ratio `buyVolume / totalVolume` (0 a 1)
  - `> 0.55`: Presión compradora dominante
  - `< 0.45`: Presión vendedora dominante

### 📈 Indicadores Técnicos
- **rsi14**: RSI de 14 períodos (0-100)
  - `< 30`: Sobrevendido
  - `> 70`: Sobrecomprado
- **sma20**: Media móvil simple de 20 períodos
- **ema9**: Media móvil exponencial rápida de 9 períodos
- **ema21**: Media móvil exponencial lenta de 21 períodos
- **volatility**: Volatilidad (desviación estándar de retornos logarítmicos últimas 20 velas)
  - En decimal: `0.02` = 2% de volatilidad

### 🎯 Heurísticas (Señales Simples)
- **ema9Above21**: Si EMA(9) > EMA(21)
  - `true`: Tendencia alcista de corto plazo
  - `false`: Tendencia bajista de corto plazo
- **rsiState**: Estado del RSI
  - `"oversold"`: RSI < 30
  - `"neutral"`: RSI 30-70
  - `"overbought"`: RSI > 70
- **buyPressure**: Si takerBuyRatio > 0.55
  - `true`: Compradores agresivos dominando
  - `false`: Vendedores dominando o equilibrado

### 💹 Market Stats (Estadísticas de Mercado)
- **fundingRate**: Tasa de financiamiento actual (decimal)
  - Positiva: Longs pagan a shorts (mercado alcista)
  - Negativa: Shorts pagan a longs (mercado bajista)
- **indexPrice**: Precio del índice spot
- **volume24h**: Volumen total últimas 24h en USD
- **high24h**: Precio más alto últimas 24h
- **low24h**: Precio más bajo últimas 24h
- **openInterest**: Open interest total (null por ahora)
- **liquidationVolume**: Volumen de liquidaciones en el período en USD

## 🧠 Uso con Agentes de IA

### Ejemplo: Análisis de Contexto Múltiple Timeframe

```python
import json
from pathlib import Path

def load_latest_data(symbol='BTCUSDT', timeframes=['1m', '5m', '15m', '1h']):
    """Carga los últimos datos de múltiples timeframes"""
    context = {}
    today = '2025-11-04'  # O usar datetime.now()
    
    for tf in timeframes:
        file_path = Path(f'logs/{tf}/market-data-{symbol}-{today}.jsonl')
        if file_path.exists():
            with open(file_path, 'r') as f:
                lines = f.readlines()
                if lines:
                    context[tf] = json.loads(lines[-1])  # Último registro
    
    return context

# Usar
ctx = load_latest_data('BTCUSDT', ['1m', '5m', '15m', '1h'])

# Análisis multi-timeframe
def analyze_trend(context):
    """Analiza la tendencia en múltiples timeframes"""
    
    # Verificar alineación de EMAs en todos los TFs
    aligned_bullish = all(
        ctx.get('heuristics', {}).get('ema9Above21') == True 
        for ctx in context.values()
    )
    
    # Verificar presión compradora
    strong_buy_pressure = sum(
        1 for ctx in context.values() 
        if ctx.get('heuristics', {}).get('buyPressure') == True
    )
    
    # RSI multi-timeframe
    rsi_values = {
        tf: ctx.get('indicators', {}).get('rsi14') 
        for tf, ctx in context.items() 
        if ctx.get('indicators', {}).get('rsi14')
    }
    
    return {
        'aligned_bullish': aligned_bullish,
        'buy_pressure_count': strong_buy_pressure,
        'total_timeframes': len(context),
        'rsi_values': rsi_values,
        'recommendation': get_recommendation(aligned_bullish, strong_buy_pressure, rsi_values)
    }

def get_recommendation(aligned, pressure_count, rsi_values):
    """Genera recomendación basada en análisis"""
    if aligned and pressure_count >= 2:
        return "STRONG_BUY"
    elif aligned:
        return "BUY"
    elif pressure_count == 0 and not aligned:
        return "SELL"
    else:
        return "NEUTRAL"

# Ejecutar análisis
analysis = analyze_trend(ctx)
print(f"Tendencia: {analysis['recommendation']}")
print(f"Alineación alcista: {analysis['aligned_bullish']}")
print(f"Presión compradora: {analysis['buy_pressure_count']}/{analysis['total_timeframes']}")
print(f"RSI por TF: {analysis['rsi_values']}")
```

### Ejemplo: Prompt para LLM

```python
def create_ai_prompt(context):
    """Crea un prompt estructurado para un LLM"""
    
    latest_1m = context.get('1m', {})
    latest_5m = context.get('5m', {})
    latest_1h = context.get('1h', {})
    
    prompt = f"""
Eres un asistente de trading experto. Analiza esta situación del mercado:

SÍMBOLO: {latest_1m.get('symbol', 'N/A')}
PRECIO ACTUAL: ${latest_1m.get('lastPrice', 0):,.2f}

ANÁLISIS 1 MINUTO:
- RSI(14): {latest_1m.get('indicators', {}).get('rsi14')}
- EMA(9): ${latest_1m.get('indicators', {}).get('ema9'):,.2f}
- EMA(21): ${latest_1m.get('indicators', {}).get('ema21'):,.2f}
- Tendencia: {'Alcista ↗' if latest_1m.get('heuristics', {}).get('ema9Above21') else 'Bajista ↘'}
- Presión: {'Compra 🟢' if latest_1m.get('heuristics', {}).get('buyPressure') else 'Venta 🔴'}
- Volatilidad: {latest_1m.get('indicators', {}).get('volatility', 0)*100:.2f}%

ANÁLISIS 5 MINUTOS:
- RSI(14): {latest_5m.get('indicators', {}).get('rsi14')}
- Tendencia: {'Alcista ↗' if latest_5m.get('heuristics', {}).get('ema9Above21') else 'Bajista ↘'}
- Buy/Sell Ratio: {latest_5m.get('micro_flow', {}).get('takerBuyRatio', 0):.2f}

ANÁLISIS 1 HORA:
- RSI(14): {latest_1h.get('indicators', {}).get('rsi14')}
- Tendencia: {'Alcista ↗' if latest_1h.get('heuristics', {}).get('ema9Above21') else 'Bajista ↘'}

LIBRO DE ÓRDENES (1m):
- Spread: {latest_1m.get('orderbook', {}).get('spreadBps', 0):.2f} bps
- Imbalance: {latest_1m.get('orderbook', {}).get('imbalance', 0)*100:.1f}% {'(bid pressure)' if latest_1m.get('orderbook', {}).get('imbalance', 0) > 0 else '(ask pressure)'}

MARKET STATS:
- Funding Rate: {latest_1m.get('market_stats', {}).get('fundingRate', 0)*100:.4f}%
- 24h High: ${latest_1m.get('market_stats', {}).get('high24h', 0):,.2f}
- 24h Low: ${latest_1m.get('market_stats', {}).get('low24h', 0):,.2f}
- 24h Volume: ${latest_1m.get('market_stats', {}).get('volume24h', 0):,.0f}
- Liquidaciones (período): ${latest_1m.get('market_stats', {}).get('liquidationVolume', 0):,.0f}

Basándote en este análisis multi-timeframe, ¿qué acción recomiendas?
Opciones: LONG, SHORT, NEUTRAL
Incluye: razón, stop loss sugerido, take profit, y nivel de confianza (1-10).
"""
    
    return prompt

# Usar con tu LLM favorito
prompt = create_ai_prompt(ctx)
# response = openai.ChatCompletion.create(...)
```

## 📚 Leer Datos Históricos

### Cargar Múltiples Períodos

```python
def load_all_records(symbol='BTCUSDT', timeframe='5m', date='2025-11-04'):
    """Carga todos los registros de un día"""
    file_path = Path(f'logs/{timeframe}/market-data-{symbol}-{date}.jsonl')
    
    records = []
    with open(file_path, 'r') as f:
        for line in f:
            if line.strip():
                records.append(json.loads(line))
    
    return records

# Cargar y analizar
data = load_all_records('BTCUSDT', '5m')

# Encontrar oportunidades
opportunities = []
for i, record in enumerate(data):
    # Ejemplo: RSI sobrevendido + presión compradora + tendencia alcista
    if (record['indicators']['rsi14'] and 
        record['indicators']['rsi14'] < 30 and
        record['heuristics']['buyPressure'] and
        record['heuristics']['ema9Above21']):
        
        opportunities.append({
            'timestamp': record['ts'],
            'price': record['lastPrice'],
            'rsi': record['indicators']['rsi14'],
            'setup': 'oversold_reversal'
        })

print(f"Encontradas {len(opportunities)} oportunidades de reversión")
```

## 🎯 Estrategias de Ejemplo

### 1. Momentum Multi-Timeframe

```python
def check_momentum_alignment(symbol='BTCUSDT'):
    """Verifica alineación de momentum en múltiples TFs"""
    ctx = load_latest_data(symbol, ['1m', '5m', '15m', '1h'])
    
    # Todos los TFs deben estar alcistas
    all_bullish = all(
        d.get('heuristics', {}).get('ema9Above21') == True 
        for d in ctx.values()
    )
    
    # RSI no sobrecomprado en TF mayor
    rsi_1h = ctx['1h'].get('indicators', {}).get('rsi14', 50)
    not_overbought = rsi_1h < 70
    
    # Presión compradora en TFs cortos
    buy_pressure_short = (
        ctx['1m'].get('heuristics', {}).get('buyPressure') or
        ctx['5m'].get('heuristics', {}).get('buyPressure')
    )
    
    if all_bullish and not_overbought and buy_pressure_short:
        return {
            'signal': 'LONG',
            'confidence': 8,
            'reason': 'Momentum alcista alineado en todos los TFs con presión compradora'
        }
    
    return {'signal': 'NEUTRAL', 'confidence': 5, 'reason': 'Sin alineación clara'}
```

### 2. Mean Reversion

```python
def check_mean_reversion(symbol='BTCUSDT'):
    """Detecta oportunidades de reversión a la media"""
    ctx = load_latest_data(symbol, ['1m', '5m'])
    
    data_1m = ctx['1m']
    
    price = data_1m['lastPrice']
    sma20 = data_1m['indicators']['sma20']
    rsi = data_1m['indicators']['rsi14']
    
    if not sma20 or not rsi:
        return {'signal': 'NEUTRAL', 'confidence': 0, 'reason': 'Datos insuficientes'}
    
    # Precio muy por debajo de SMA20 + RSI sobrevendido
    price_deviation = (price - sma20) / sma20
    
    if price_deviation < -0.02 and rsi < 30:
        return {
            'signal': 'LONG',
            'confidence': 7,
            'reason': f'Precio {price_deviation*100:.1f}% bajo SMA20 con RSI={rsi:.1f}',
            'target': sma20,
            'stop': price * 0.98
        }
    
    # Precio muy por encima de SMA20 + RSI sobrecomprado
    if price_deviation > 0.02 and rsi > 70:
        return {
            'signal': 'SHORT',
            'confidence': 7,
            'reason': f'Precio {price_deviation*100:.1f}% sobre SMA20 con RSI={rsi:.1f}',
            'target': sma20,
            'stop': price * 1.02
        }
    
    return {'signal': 'NEUTRAL', 'confidence': 5, 'reason': 'Precio cerca de media'}
```

### 3. Liquidation Spikes

```python
def check_liquidation_spike(symbol='BTCUSDT'):
    """Detecta spikes de liquidaciones"""
    records = load_all_records(symbol, '1m')
    recent = records[-10:]  # Últimos 10 minutos
    
    # Volumen de liquidaciones reciente
    liq_volumes = [r['market_stats']['liquidationVolume'] for r in recent]
    avg_liq = sum(liq_volumes) / len(liq_volumes)
    latest_liq = liq_volumes[-1]
    
    # Spike de liquidaciones (3x el promedio)
    if latest_liq > avg_liq * 3 and latest_liq > 100000:
        # Verificar si hay reversión
        latest = recent[-1]
        
        return {
            'signal': 'LONG' if latest['heuristics']['buyPressure'] else 'SHORT',
            'confidence': 6,
            'reason': f'Spike de liquidaciones: ${latest_liq:,.0f} (promedio: ${avg_liq:,.0f})',
            'risk': 'HIGH'
        }
    
    return {'signal': 'NEUTRAL', 'confidence': 5, 'reason': 'Sin spikes de liquidaciones'}
```

## 🔧 Utilidades

### Ver Logs en Tiempo Real

```bash
# Ver últimos JSONs de 1m
tail -f logs/1m/market-data-BTCUSDT-2025-11-04.jsonl | jq '.'

# Solo RSI
tail -f logs/1m/market-data-BTCUSDT-2025-11-04.jsonl | jq '.indicators.rsi14'

# Filtrar por condiciones
tail -f logs/1m/market-data-BTCUSDT-2025-11-04.jsonl | jq 'select(.heuristics.buyPressure == true)'
```

### Estadísticas Rápidas

```bash
# Contar registros por timeframe
npm run logs -- --timeframe=5m --stats

# Ver últimos 10 registros
npm run logs -- --timeframe=1m --last=10

# Análisis específico de símbolo
npm run logs -- --timeframe=15m --symbol=ETHUSDT --stats
```

## 📊 Dashboard Example

```python
import pandas as pd
import json

def create_dashboard(symbol='BTCUSDT', timeframe='5m'):
    """Crea un DataFrame de pandas con los datos"""
    records = load_all_records(symbol, timeframe)
    
    df = pd.DataFrame([
        {
            'timestamp': r['ts'],
            'price': r['lastPrice'],
            'rsi14': r['indicators']['rsi14'],
            'ema9': r['indicators']['ema9'],
            'ema21': r['indicators']['ema21'],
            'volatility': r['indicators']['volatility'],
            'buy_ratio': r['micro_flow']['takerBuyRatio'],
            'spread_bps': r['orderbook']['spreadBps'],
            'imbalance': r['orderbook']['imbalance'],
            'funding_rate': r['market_stats']['fundingRate'],
            'liq_volume': r['market_stats']['liquidationVolume']
        }
        for r in records
    ])
    
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df.set_index('timestamp', inplace=True)
    
    return df

# Usar
df = create_dashboard('BTCUSDT', '5m')

# Análisis
print(df.describe())
print(f"\nRSI Promedio: {df['rsi14'].mean():.2f}")
print(f"Volatilidad Promedio: {df['volatility'].mean()*100:.2f}%")
print(f"Buy Ratio Promedio: {df['buy_ratio'].mean():.2f}")

# Correlaciones
print("\nCorrelaciones:")
print(df.corr()['price'].sort_values(ascending=False))
```

## 🚨 Alertas en Tiempo Real

```python
import time
import json

def monitor_conditions(symbol='BTCUSDT', timeframe='1m'):
    """Monitorea condiciones y alerta"""
    
    while True:
        ctx = load_latest_data(symbol, [timeframe])
        data = ctx[timeframe]
        
        # Condiciones de alerta
        alerts = []
        
        # RSI extremos
        rsi = data['indicators']['rsi14']
        if rsi and rsi < 25:
            alerts.append(f"🔴 RSI MUY BAJO: {rsi:.1f}")
        elif rsi and rsi > 75:
            alerts.append(f"🔴 RSI MUY ALTO: {rsi:.1f}")
        
        # Spread anormal
        spread_bps = data['orderbook']['spreadBps']
        if spread_bps > 5:
            alerts.append(f"⚠️  SPREAD ALTO: {spread_bps:.2f} bps")
        
        # Liquidaciones masivas
        liq_vol = data['market_stats']['liquidationVolume']
        if liq_vol > 500000:
            alerts.append(f"💥 LIQUIDACIONES MASIVAS: ${liq_vol:,.0f}")
        
        # Volatilidad extrema
        vol = data['indicators']['volatility']
        if vol and vol > 0.05:
            alerts.append(f"⚡ VOLATILIDAD EXTREMA: {vol*100:.2f}%")
        
        # Imprimir alertas
        if alerts:
            print(f"\n🚨 ALERTAS - {data['ts']}")
            for alert in alerts:
                print(f"   {alert}")
        
        time.sleep(60)  # Esperar 1 minuto
```

## 📝 Notas Importantes

1. **Formato JSONL**: Un JSON por línea - fácil de procesar streaming
2. **Indicadores Pre-inicializados**: Los indicadores se cargan con datos históricos al inicio
3. **Volatilidad**: Basada en retornos logarítmicos de últimas 20 velas
4. **Multi-Timeframe**: Captura simultánea en 6 timeframes diferentes
5. **Open Interest**: Requiere stream adicional, actualmente en `null`

## 🎓 Recursos

- `LOGS_STRUCTURE.md` - Documentación completa del sistema
- `WS_QUICK_START.md` - Guía rápida de inicio
- `AI_DATA_STREAMS.md` - Detalles de todos los streams

---

**Versión**: 3.0  
**Última actualización**: 2025-11-04

