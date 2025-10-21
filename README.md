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

## 🗂️ Estructura
```
scripts/                # Ejemplos ejecutables (REST y WebSocket)
src/
  config/env.example    # Plantilla opcional para credenciales
  index.ts              # Punto de entrada que reexporta servicios/modelos
  models/               # Candle / Trade (TypeScript)
  services/             # BinanceClient / WebSocketService (TypeScript)
dist/                  # Salida compilada por tsc (generada)
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

## ➡️ Qué hacer a partir de aquí
1. Crea tus propias estrategias o bots en nuevas carpetas (por ejemplo `strategies/` o `bots/`).
2. Monta scripts o servicios que consuman `BinanceClient` / `WebSocketService`.
3. Añade pruebas, linters o cualquier infraestructura adicional que necesites.
4. Si querés levantar un API o CLI, constrúyelo encima de estos componentes limpios.

Con esta base liviana controlás exactamente qué lógica volver a construir, sin arrastrar código heredado. ¡A experimentar! 💡
# Trading-Agent
