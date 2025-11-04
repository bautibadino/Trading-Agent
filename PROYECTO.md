# 📡 Trading Bot Market Core

> Sistema completo de captura y análisis de datos de Binance Futures en tiempo real

## 📋 Índice

- [¿Qué es este proyecto?](#qué-es-este-proyecto)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Instalación](#instalación)
- [Scripts NPM Disponibles](#scripts-npm-disponibles)
- [Uso del Sistema](#uso-del-sistema)
- [API REST](#api-rest)
- [Sistema de Logs para IA](#sistema-de-logs-para-ia)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## 🎯 ¿Qué es este proyecto?

Sistema modular en TypeScript para conectarse a **Binance Futures** y capturar datos de mercado en tiempo real con análisis técnico integrado. Perfecto para trading algorítmico, machine learning y análisis de mercado.

### Features Principales

✅ **Cliente REST** - Precios, velas, book de órdenes, cuentas firmadas  
✅ **Cliente WebSocket** - Streams en tiempo real de trades, ticker, klines, order book  
✅ **Sistema de Logs** - Captura completa de market data en 6 timeframes simultáneos  
✅ **Indicadores Técnicos** - RSI, EMA, SMA, Volatilidad pre-calculados  
✅ **API Server** - Servidor Express para acceso remoto a logs y datos  
✅ **Backtest Engine** - Motor de backtesting con estrategia de scalping  
✅ **Multi-timeframe** - 1m, 5m, 15m, 30m, 1h, 4h  

### ¿Para qué sirve?

1. **Trading Algorítmico** - Estrategias automatizadas con datos en tiempo real
2. **Machine Learning** - Entrenamiento de IA con datos históricos completos
3. **Backtesting** - Prueba de estrategias con datos reales
4. **Análisis de Mercado** - Monitoreo y análisis de tendencias
5. **Alertas** - Sistema de notificaciones basado en condiciones específicas

---

## 📂 Estructura del Proyecto

```
trading-bot-api/
├── src/                          # Código fuente TypeScript
│   ├── services/
│   │   ├── BinanceClient.ts      # Cliente REST para Binance API
│   │   └── WebSocketService.ts   # Cliente WebSocket para streams
│   ├── models/
│   │   ├── Candle.ts             # Modelo de velas OHLCV
│   │   └── Trade.ts              # Modelo de trades
│   ├── strategies/
│   │   └── ScalpingPullbackStrategy.ts  # Estrategia de scalping
│   ├── server/
│   │   ├── index.ts              # Servidor Express API
│   │   ├── controllers/          # Controladores de API
│   │   ├── routes/               # Rutas de API
│   │   └── services/             # Servicios del servidor
│   └── config/
│       └── env.example           # Plantilla de variables de entorno
│
├── scripts/                      # Scripts ejecutables
│   ├── ws-futures-ai.ts          # Captura de datos para IA
│   ├── live-scalping-backtest.ts # Backtesting en vivo
│   ├── read-logs.ts              # Lectura de logs
│   ├── ws-listener.ts            # WebSocket listener básico
│   ├── rest-example.ts           # Ejemplo de cliente REST
│   ├── start-all-timeframes.sh   # Iniciar todos los timeframes
│   └── stop-all-timeframes.sh    # Detener todos los timeframes
│
├── dist/                         # Código compilado (generado por tsc)
├── logs/                         # Logs de market data
│   ├── 1m/                       # 1,440 registros/día
│   ├── 5m/                       # 288 registros/día
│   ├── 15m/                      # 96 registros/día
│   ├── 30m/                      # 48 registros/día
│   ├── 1h/                       # 24 registros/día
│   └── 4h/                       # 6 registros/día
│
├── reports/                      # Reportes de backtesting
├── package.json                  # Dependencias y scripts
├── tsconfig.json                 # Configuración TypeScript
├── ecosystem.config.js           # Configuración PM2
├── railway.json                  # Configuración Railway
├── nixpacks.toml                 # Build config Railway
└── Procfile                      # Para Heroku/otros

```

---

## 🚀 Instalación

### Requisitos
- **Node.js 22+**
- **npm** o **yarn**
- Cuenta en Binance (opcional, solo para endpoints firmados)

### Pasos

```bash
# 1. Clonar repositorio
git clone <tu-repo>
cd trading-bot-api

# 2. Instalar dependencias
npm install

# 3. Compilar TypeScript
npm run build

# 4. (Opcional) Configurar credenciales de Binance
cp src/config/env.example .env
# Editar .env con tus credenciales
```

### Variables de Entorno (Opcional)

```bash
BINANCE_API_KEY=tu_api_key
BINANCE_API_SECRET=tu_api_secret
PORT=3000
```

---

## ⚙️ Scripts NPM Disponibles

### 📦 Build y Desarrollo

| Script | Comando | Descripción |
|--------|---------|-------------|
| **build** | `npm run build` | Compila TypeScript a JavaScript en `dist/` |
| **start** | `npm start` | Inicia el servidor API en producción |
| **dev** | `npm run dev` | Modo desarrollo con watch (recompila automáticamente) |

### 🌐 WebSocket - Captura de Datos para IA

| Script | Comando | Descripción |
|--------|---------|-------------|
| **ws:futures** | `npm run ws:futures` | BTCUSDT 1m (por defecto) |
| **ws:futures:eth** | `npm run ws:futures:eth` | ETHUSDT 1m |
| **ws:futures:1m** | `npm run ws:futures:1m` | Captura cada 1 minuto |
| **ws:futures:5m** | `npm run ws:futures:5m` | Captura cada 5 minutos (recomendado) |
| **ws:futures:15m** | `npm run ws:futures:15m` | Captura cada 15 minutos |
| **ws:futures:30m** | `npm run ws:futures:30m` | Captura cada 30 minutos |
| **ws:futures:1h** | `npm run ws:futures:1h` | Captura cada 1 hora |
| **ws:futures:4h** | `npm run ws:futures:4h` | Captura cada 4 horas |
| **start:all** | `npm run start:all` | Inicia TODOS los timeframes (1m, 5m, 15m, 30m, 1h, 4h) |
| **stop:all** | `npm run stop:all` | Detiene todos los procesos de captura |

### 📊 Backtesting

| Script | Comando | Descripción |
|--------|---------|-------------|
| **live** | `npm run live` | Backtest con BTCUSDT por defecto |
| **live:eth** | `npm run live:eth` | Preset ETH 1m, 300 velas, delay 100ms |
| **live:btc** | `npm run live:btc` | Preset BTC scalping rápido |
| **live:stream** | `npm run live:stream` | Backtest en tiempo real con WebSocket |
| **live:help** | `npm run live:help` | Muestra todas las opciones disponibles |

### 📖 Consulta de Logs

| Script | Comando | Descripción |
|--------|---------|-------------|
| **logs** | `npm run logs` | Ver último registro guardado |
| **logs (custom)** | `npm run logs -- --timeframe=5m --last=10 --stats` | Ver últimos 10 logs de 5m con estadísticas |

### 🧪 Otros Scripts

| Script | Comando | Descripción |
|--------|---------|-------------|
| **ws** | `npm run ws` | WebSocket básico (ticker BTCUSDT) |
| **rest** | `npm run rest` | Ejemplo de cliente REST |
| **w** | `npm run w` | WebSocket con AI data para BTCUSDT |

---

## 💻 Uso del Sistema

### 1. Capturar Datos en Tiempo Real

#### Opción A: Un Solo Timeframe

```bash
# Captura de 5 minutos (recomendado para empezar)
npm run ws:futures:5m

# Captura de 1 minuto (más datos)
npm run ws:futures:1m

# Captura de 1 hora (visión macro)
npm run ws:futures:1h
```

#### Opción B: Todos los Timeframes (Mejor para IA)

```bash
# Iniciar captura en TODOS los timeframes
npm run start:all

# Detener todos
npm run stop:all
```

**Archivos generados:**
```
logs/1m/market-data-BTCUSDT-2025-11-04.jsonl
logs/5m/market-data-BTCUSDT-2025-11-04.jsonl
logs/15m/market-data-BTCUSDT-2025-11-04.jsonl
logs/30m/market-data-BTCUSDT-2025-11-04.jsonl
logs/1h/market-data-BTCUSDT-2025-11-04.jsonl
logs/4h/market-data-BTCUSDT-2025-11-04.jsonl
```

### 2. Ver los Datos Capturados

#### En Terminal

```bash
# Ver último registro
npm run logs

# Ver últimos 5 registros
npm run logs -- --last=5

# Ver estadísticas
npm run logs -- --stats

# Timeframe y símbolo específico
npm run logs -- --timeframe=5m --symbol=ETHUSDT --last=3
```

#### En Tiempo Real con jq

```bash
# Ver JSONs en tiempo real con formato
tail -f logs/5m/market-data-BTCUSDT-2025-11-04.jsonl | jq '.'

# Solo ver RSI
tail -f logs/1m/market-data-BTCUSDT-2025-11-04.jsonl | jq '.indicators.rsi14'

# Ver cuando hay presión compradora
tail -f logs/1m/market-data-BTCUSDT-2025-11-04.jsonl | jq 'select(.heuristics.buyPressure == true)'
```

### 3. Backtest de Estrategias

```bash
# Backtest básico con BTCUSDT
npm run live

# Preset optimizado para ETH
npm run live:eth

# Backtest en tiempo real con WebSocket
npm run live:stream

# Ver todas las opciones
npm run live:help

# Backtest personalizado
npm run live -- --symbol ETHUSDT --interval 1m --limit 300 --delay 100
```

**Flags disponibles:**
- `--symbol` - Par de trading (BTCUSDT, ETHUSDT, etc.)
- `--interval` - Timeframe (1m, 5m, 15m, etc.)
- `--limit` - Número de velas a procesar
- `--delay` - Delay entre velas en ms
- `--mode` - rest (histórico) o stream (tiempo real)
- `--warmup` - Velas para precalentar indicadores
- `--balance` - Capital inicial

### 4. Ejecutar el Servidor API

```bash
# Compilar y ejecutar
npm run build
npm start

# Modo desarrollo (recompila automáticamente)
npm run dev
```

El servidor se inicia en `http://localhost:3000`

---

## 🌐 API REST

### Endpoints Disponibles

#### Health Check
```bash
GET /health
```
Verifica que el servidor esté funcionando.

**Respuesta:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-04T12:00:00.000Z",
  "uptime": 123.45
}
```

#### Obtener Logs
```bash
GET /api/logs?timeframe=1m&symbol=ETHUSDT&limit=100&date=2025-11-04
```

**Parámetros:**
- `timeframe` - 1m, 5m, 15m, 30m, 1h, 4h
- `symbol` - BTCUSDT, ETHUSDT, etc.
- `limit` - Número de logs (default: 100)
- `date` - Fecha específica (opcional)

**Respuesta:**
```json
{
  "logs": [...],
  "count": 100,
  "timeframe": "1m",
  "symbol": "ETHUSDT"
}
```

#### Listar Archivos de Logs
```bash
GET /api/logs/files?timeframe=1m
```

**Respuesta:**
```json
{
  "files": [
    {
      "name": "market-data-BTCUSDT-2025-11-04.jsonl",
      "size": 1234567,
      "modified": "2025-11-04T12:00:00.000Z"
    }
  ]
}
```

#### Estadísticas de Logs
```bash
GET /api/logs/stats
```

**Respuesta:**
```json
{
  "stats": {
    "1m": { "files": 5, "totalSize": 123456, "totalLines": 1440 },
    "5m": { "files": 3, "totalSize": 67890, "totalLines": 288 }
  }
}
```

#### Iniciar Collector
```bash
POST /api/collectors/start
Content-Type: application/json

{
  "timeframe": "1m",
  "symbol": "ETHUSDT"
}
```

### Ejemplo de Uso desde JavaScript

```javascript
const API_URL = 'http://localhost:3000';

// Obtener últimos 10 logs de 1m
const response = await fetch(`${API_URL}/api/logs?timeframe=1m&limit=10`);
const data = await response.json();
console.log(data.logs);

// Iniciar collector
await fetch(`${API_URL}/api/collectors/start`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ timeframe: '5m', symbol: 'ETHUSDT' })
});

// Ver estadísticas
const stats = await fetch(`${API_URL}/api/logs/stats`).then(r => r.json());
console.log(stats);
```

---

## 🤖 Sistema de Logs para IA

### Estructura del JSON

Cada línea del archivo `.jsonl` contiene un JSON completo con toda la información del mercado:

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

### Descripción de Campos

#### Información Básica
- **ts** - Timestamp ISO 8601
- **symbol** - Par de trading
- **lastPrice** - Último precio de trade

#### Order Book
- **bestBid/bestAsk** - Mejor precio y cantidad de compra/venta
- **mid** - Precio medio `(bid + ask) / 2`
- **spread** - Diferencia `ask - bid`
- **spreadBps** - Spread en basis points
- **imbalance** - Ratio de presión bid/ask (0-1)
- **microprice** - Precio ponderado por cantidades

#### Micro Flow
- **takerBuyQuote** - Volumen de compras agresivas en el período
- **takerSellQuote** - Volumen de ventas agresivas en el período
- **takerBuyRatio** - Ratio de compras (0=100% venta, 1=100% compra)

#### Indicadores Técnicos
- **rsi14** - RSI de 14 períodos (0-100)
- **sma20** - Media móvil simple de 20 períodos
- **ema9** - Media móvil exponencial rápida
- **ema21** - Media móvil exponencial lenta
- **volatility** - Volatilidad (desviación estándar de retornos)

#### Heurísticas
- **ema9Above21** - ¿EMA rápida por encima de lenta? (tendencia alcista)
- **rsiState** - "oversold", "neutral", "overbought"
- **buyPressure** - ¿Presión compradora dominante?

#### Market Stats
- **fundingRate** - Tasa de financiamiento actual
- **indexPrice** - Precio del índice
- **volume24h** - Volumen de 24 horas
- **high24h/low24h** - Máximo/mínimo de 24h
- **liquidationVolume** - Volumen de liquidaciones

### Uso con Python / IA

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

### Multi-Timeframe Analysis

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

---

## 🚀 Deployment

### Railway (Recomendado)

#### 1. Preparar Repositorio
```bash
git add .
git commit -m "Preparar para deployment"
git push
```

#### 2. Crear Proyecto en Railway
1. Ve a [railway.app](https://railway.app)
2. Click en "New Project" → "Deploy from GitHub repo"
3. Selecciona tu repositorio
4. Railway detectará automáticamente `railway.json`

#### 3. Configurar Variables (Opcional)
```
BINANCE_API_KEY=tu_api_key
BINANCE_API_SECRET=tu_api_secret
```

#### 4. Verificar Deployment
```bash
# Health check
curl https://tu-proyecto.up.railway.app/health

# Ver logs
curl https://tu-proyecto.up.railway.app/api/logs?timeframe=1m&limit=5
```

### Otras Plataformas

#### Render.com
- Build Command: `npm run build`
- Start Command: `npm start`

#### Fly.io
```bash
fly launch
fly deploy
```

#### VPS con PM2
```bash
# Instalar PM2
npm install -g pm2

# Iniciar
pm2 start ecosystem.config.js

# Guardar configuración
pm2 save
pm2 startup
```

### Notas Importantes sobre Deployment

⚠️ **Almacenamiento de Logs**: Railway usa volúmenes efímeros. Los logs se pierden al reiniciar.

**Soluciones:**
1. **Volumen Persistente** (requiere plan de pago)
2. **Base de Datos** (PostgreSQL, MongoDB)
3. **Storage Externo** (S3, Google Cloud Storage)

---

## 🔧 Troubleshooting

### WebSocket se desconecta rápidamente

**Problema:** `Socket connection timeout`

**Solución:**
```bash
# Aumentar timeout
npm run ws:futures:5m -- --timeout=30000

# Desactivar heartbeat si el firewall bloquea pings
npm run ws:futures:5m -- --heartbeat=0
```

### Error: Cannot find module

**Problema:** No se compiló TypeScript

**Solución:**
```bash
npm run build
```

### Los indicadores están vacíos (null)

**Problema:** No hay suficientes datos históricos

**Solución:** Los indicadores necesitan un warmup. El sistema automáticamente precarga 500 velas históricas antes de iniciar.

### Error de compilación TypeScript

**Problema:** Versión incorrecta o dependencias faltantes

**Solución:**
```bash
# Limpiar y reinstalar
rm -rf node_modules package-lock.json dist
npm install
npm run build
```

### El servidor no inicia

**Problema:** Puerto en uso

**Solución:**
```bash
# Cambiar puerto
PORT=3001 npm start

# O matar el proceso que usa el puerto 3000
lsof -ti:3000 | xargs kill -9
```

### Problemas de memoria en deployment

**Problema:** El proceso se detiene por falta de memoria

**Solución:**
- Limita el número de collectors simultáneos
- Usa un plan con más memoria
- Implementa rotación de logs

---

## 📦 Dependencias Principales

```json
{
  "dependencies": {
    "axios": "^1.6.0",           // Cliente HTTP
    "chalk": "^5.6.2",           // Colores en terminal
    "cli-table3": "^0.6.5",      // Tablas en terminal
    "cors": "^2.8.5",            // CORS para API
    "express": "^4.18.2",        // Servidor API
    "trading-signals": "^7.0.0", // Indicadores técnicos
    "ws": "^8.14.0"              // WebSocket client
  }
}
```

---

## 👤 Autor

**Bautista Badino**

---

## 📝 Licencia

MIT License

---

## 🎯 Casos de Uso

### 1. Trading Algorítmico
Usa los datos en tiempo real para ejecutar estrategias automatizadas.

### 2. Machine Learning
Entrena modelos de IA con datos históricos completos y features calculadas.

### 3. Backtesting
Prueba estrategias con datos reales antes de operar.

### 4. Análisis de Mercado
Monitorea tendencias y patrones en múltiples timeframes.

### 5. Alertas y Notificaciones
Crea sistemas de alertas basados en condiciones específicas.

---

## ⚡ Tips y Mejores Prácticas

✅ **Para desarrollo:** Usa `1m` para ver resultados rápido  
✅ **Para producción:** Combina `5m` + `1h` + `4h`  
✅ **Para backtesting:** Lee los archivos `.jsonl` completos  
✅ **Para alertas:** Monitorea `1m` en tiempo real  
✅ **Para análisis:** Usa todos los timeframes simultáneamente  

---

## 📊 Resumen de Comandos Más Usados

```bash
# Build
npm run build

# Captura de datos
npm run ws:futures:5m                    # Un timeframe
npm run start:all                        # Todos los timeframes

# Ver datos
npm run logs                             # Último registro
npm run logs -- --stats                  # Estadísticas

# Backtest
npm run live                             # Backtest básico
npm run live:help                        # Ver opciones

# Servidor API
npm start                                # Iniciar servidor

# Control
npm run stop:all                         # Detener todo
```

---

**Sistema listo para producción** 🚀

Para soporte o consultas, revisa el código fuente o contacta al mantenedor.

