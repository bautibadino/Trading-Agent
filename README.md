# 📡 Binance Market Data Core

Base mínima para conectarte a Binance desde Node.js sin ninguna lógica de estrategias ni backtesting. El repositorio ahora solo contiene bloques reutilizables bien organizados:

- **Cliente REST** (`src/services/BinanceClient.js`): ping, precios, velas, libro de órdenes, cuentas firmadas, etc.
- **Cliente WebSocket** (`src/services/WebSocketService.ts`): streams en tiempo real de trades, ticker, klines, order book…
- **Modelos auxiliares** (`src/models`): clases `Candle` y `Trade` para normalizar datos.
- **Código fuente en TypeScript**: tipado estricto con compilación a `dist/`.
- **Scripts de ejemplo** (`scripts/`): atajos listos para REST (`npm run rest`) y WebSocket (`npm run ws`).

## 🚀 Instalación
```bash
git clone <repo>
cd trading-bot
npm install

# Compilar TypeScript -> dist/
npm run build

# Opcional: variables de entorno para credenciales firmadas
cp src/config/env.example .env
```

Opciones de uso:
- Ejecuta los scripts incluidos para pruebas rápidas (`npm run rest`, `npm run ws`).
- Importa las clases directamente en tus bots (`import { BinanceClient } from './src/index.js'`).

### Scripts rápidos

```bash
npm run build                         # compila TypeScript a dist/

npm run ws                            # ticker BTCUSDT por defecto
npm run ws -- --symbol=ETHUSDT --stream=trades
npm run ws -- --symbol=BTCUSDT --stream=klines --interval=15m

npm run rest                          # precio + 5 velas 1h por defecto
npm run rest -- --symbol=ETHUSDT --interval=4h --limit=10

npm run live                          # backtest scalping pullback (defaults BTCUSDT)
npm run live:help                     # muestra todas las flags disponibles
npm run live:eth                      # preset ETH 1m, 300 velas, delay 100ms, balance 10k
npm run live:btc                      # preset BTC scalping rápido
npm run live:stream                   # modo streaming (WebSocket) con warmup de 500 velas por defecto
npm run live -- --symbol ETHUSDT --interval 1m --limit 300 --delay 100
```

> Si la conexión WebSocket expira rápido (`Socket connection timeout`), aumenta el timeout: `npm run ws -- --timeout=30000`.
> El script usa `npx node@22` y fuerza IPv4 (`--dns-result-order=ipv4first`). La primera ejecución puede descargar el binario; si preferís tu propia versión ejecutá `node scripts/ws-listener.ts` manualmente tras compilar.
> También podés desactivar el ping con `--heartbeat=0` cuando la red esté filtrada por firewall.

## 💡 Ejemplos rápidos

### REST
```javascript
import { BinanceClient } from './dist/index.js';

const client = new BinanceClient(); // usa BINANCE_API_KEY/SECRET si están en el entorno

const price = await client.getCurrentPrice('BTCUSDT');
console.log(price); // { symbol: 'BTCUSDT', price: 67890.12 }

const klines = await client.getKlines('ETHUSDT', '1h', { limit: 50 });
console.log(klines[0]); // instancia Candle
```

### WebSocket
```javascript
import { WebSocketService } from './dist/index.js';

const ws = new WebSocketService();

ws.connectToTrades('BTCUSDT', (trade) => {
    console.log('Trade recibido:', trade.toJSON());
});

ws.connectToTicker('ETHUSDT', (ticker) => {
    console.log('Ticker ETHUSDT:', ticker.c);
});
```

## 🌐 Servidor API (NUEVO)

El proyecto ahora incluye un servidor Express que expone los datos y logs vía REST API, perfecto para usar desde un frontend remoto.

### Ejecutar el servidor localmente:

```bash
npm run build
npm start
```

El servidor se iniciará en `http://localhost:3000`

### Endpoints disponibles:

- `GET /health` - Health check
- `GET /api/logs?timeframe=1m&symbol=ETHUSDT&limit=100` - Obtener logs
- `GET /api/logs/files?timeframe=1m` - Listar archivos disponibles
- `GET /api/logs/stats` - Estadísticas de logs
- `POST /api/collectors/start` - Iniciar un collector

Ver [`DEPLOYMENT.md`](./DEPLOYMENT.md) para más detalles sobre deployment en producción.

## 🚀 Deployment en Producción

El proyecto está listo para deployar en Railway, Render, Fly.io, o cualquier plataforma compatible con Node.js.

**Guía completa**: Ver [`DEPLOYMENT.md`](./DEPLOYMENT.md)

**Deployment rápido en Railway:**
1. Push tu código a GitHub
2. Conecta tu repo en Railway
3. Railway detectará automáticamente `railway.json` y deployará
4. Accede a tu API desde la URL proporcionada

## 🗂️ Estructura
```
scripts/                # Ejemplos ejecutables (REST y WebSocket)
src/
  config/env.example    # Plantilla opcional para credenciales
  server/               # Servidor Express API (NUEVO)
    index.ts            # Servidor principal
  index.ts              # Punto de entrada que reexporta servicios/modelos
  models/               # Candle / Trade (TypeScript)
  services/             # BinanceClient / WebSocketService (TypeScript)
dist/                  # Salida compilada por tsc (generada)
logs/                  # Logs de market data por timeframe
railway.json           # Configuración para Railway
nixpacks.toml          # Configuración de build para Railway
Procfile               # Para Heroku/otros
tsconfig.json
.gitignore
package.json
package-lock.json
```


## 🧪 Backtest en vivo con trading-signals
- Estrategia `live-scalping-backtest` usa `trading-signals` (EMA/ATR) para detectar pullbacks/throwbacks de scalping.
- Ejecutá `npm run live` para simular secuencialmente velas históricas en consola o `npm run live:help` para ver todas las flags y presets (`eth-scalp`, `btc-scalp-fast`, etc.).
- Flags disponibles: `--symbol`, `--interval`, `--limit`, `--delay`, `--fast`, `--slow`, `--trend`, `--atr`, `--atrStop`, `--atrTp`, `--size`, `--minAtr`, `--balance`, `--mode` (`rest`|`stream`), `--warmup` y `--timeout`. Ahora podés usarlas tanto con `--clave=valor` como con `--clave valor`.
- `--mode=rest` (por defecto) procesa velas históricas; `--mode=stream` se conecta al WebSocket y ejecuta la estrategia en tiempo real. `--warmup` define cuántas velas históricas precalientan los indicadores antes de iniciar el streaming y `--timeout` ajusta el handshake del WebSocket (ideal si tu red cierra sockets IPv6).
- `--mode=rest` (por defecto) procesa velas históricas; `--mode=stream` se conecta al WebSocket y ejecuta la estrategia en tiempo real. `--warmup` define cuántas velas históricas precalientan los indicadores antes de iniciar el streaming.
- Salida mejorada: cada entrada/salida se imprime en tablas con colores, mostrando SL/TP, ATR/R múltiple, PnL y balance actualizado para facilitar la lectura en consola.
- Cada corrida guarda un JSON en `reports/` con todos los parámetros usados, eventos (entradas/salidas) y métricas de performance para análisis posterior (los archivos de streaming se guardan con prefijo `live-stream-*`).
- Resumen final en tabla con capital inicial, PnL neto, trades, win rate y drawdown máximo.

## 🤖 Sistema de Logs para IA (NUEVO)

### Captura completa de market data en tiempo real

El sistema ahora incluye captura profesional de datos en **6 timeframes simultáneos** con:

✅ Order book (spread, imbalance, microprice)  
✅ Micro flow (presión compradora/vendedora)  
✅ Indicadores técnicos (RSI, EMA, SMA, Volatilidad)  
✅ Market stats (funding rate, 24h stats, liquidaciones)  
✅ Heurísticas pre-calculadas  

```bash
# Capturar todos los timeframes para BTCUSDT
npm run start:all

# O un solo timeframe
npm run ws:futures:5m      # Emite JSON cada 5 minutos
npm run ws:futures:1h      # Emite JSON cada hora

# Ver los datos
npm run logs -- --timeframe=5m --stats

# Detener todo
npm run stop:all
```

**Archivos generados**: `logs/1m/`, `logs/5m/`, `logs/15m/`, `logs/30m/`, `logs/1h/`, `logs/4h/`

📖 **Ver guía completa**: [`QUICK_START_AI.md`](./QUICK_START_AI.md) y [`AI_LOGS_GUIDE.md`](./AI_LOGS_GUIDE.md)

## ➡️ Qué hacer a partir de aquí
1. Crea tus propias estrategias o bots en nuevas carpetas (por ejemplo `strategies/` o `bots/`).
2. Monta scripts o servicios que consuman `BinanceClient` / `WebSocketService`.
3. Usa el sistema de logs para entrenar o alimentar agentes de IA.
4. Añade pruebas, linters o cualquier infraestructura adicional que necesites.
5. Si querés levantar un API o CLI, constrúyelo encima de estos componentes limpios.

Con esta base liviana controlás exactamente qué lógica volver a construir, sin arrastrar código heredado. ¡A experimentar! 💡
