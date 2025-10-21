# GUÍA COMPLETA API BINANCE (SPOT + SAPI + FUTURES) — ENDPOINT POR ENDPOINT

BINANCE_API_KEY=XgU0MAVsMaLCQdTEkBO1nzT5MDP5T3rzpuN6zq713rNOpjGccUjIRthEMHXnmQFZ
BINANCE_API_SECRET=CRMNLAudq0LwIAOJnxzNvvOjfdejgmLgohNXnqtNRBNvAJBfTEAlVcayDXfNy5HL


## 0) CONCEPTOS BASE

- Tipos de API:
  - SPOT REST → `/api/*`
  - SAPI (Spot Account / Wallet / Margin / Earn / Subcuentas) → `/sapi/*`
  - FUTURES USDT-M → `/fapi/*`
  - FUTURES COIN-M → `/dapi/*`
  - WEBSOCKETS → `wss://...`

- Base URLs:
  - SPOT REST: `https://api.binance.com`
  - SPOT WS: `wss://stream.binance.com:9443`
  - FUTURES USDT-M REST: `https://fapi.binance.com`
  - FUTURES WS: `wss://fstream.binance.com`

- Seguridad:
  - Rutas públicas → sin key
  - Rutas privadas → Header `X-MBX-APIKEY`
  - SIGNED → requiere `timestamp` + `signature` HMAC-SHA256 (secret)

---

## 1) SPOT MARKET DATA (public)

| Endpoint | Descripción |
|----------|-------------|
| GET /api/v3/ping | Test |
| GET /api/v3/time | Hora del server |
| GET /api/v3/exchangeInfo | Info de símbolos y filtros |
| GET /api/v3/depth | Order book |
| GET /api/v3/trades | Trades recientes |
| GET /api/v3/historicalTrades | Trades históricos (requiere API key) |
| GET /api/v3/aggTrades | Trades agregados |
| GET /api/v3/klines | Velas OHLCV |
| GET /api/v3/avgPrice | Precio promedio |
| GET /api/v3/ticker/24hr | Variación 24h |
| GET /api/v3/ticker/price | Último precio |
| GET /api/v3/ticker/bookTicker | Mejor bid/ask |

---

## 2) SPOT TRADING (privado, requiere APIKEY + SIGNED)

| Acción | Endpoint |
|--------|----------|
| Crear orden | POST /api/v3/order |
| Test para crear | POST /api/v3/order/test |
| Obtener orden | GET /api/v3/order |
| Cancelar orden | DELETE /api/v3/order |
| Cancelar todas por símbolo | DELETE /api/v3/openOrders?symbol=XXX |
| Órdenes abiertas | GET /api/v3/openOrders |
| Historial órdenes | GET /api/v3/allOrders |
| Trades ejecutados | GET /api/v3/myTrades |
| Info cuenta | GET /api/v3/account |

---

## 3) OCO (One-Cancels-the-Other)

| Acción | Endpoint |
|--------|----------|
| Crear OCO | POST /api/v3/order/oco |
| Cancelar OCO | DELETE /api/v3/orderList |
| Obtener OCO | GET /api/v3/orderList |
| OCO abiertos | GET /api/v3/openOrderList |
| OCO historial | GET /api/v3/allOrderList |

---

## 4) USER DATA STREAM (SPOT)

| Acción | Endpoint |
|--------|----------|
| Crear listenKey | POST /api/v3/userDataStream |
| Mantener vivo | PUT /api/v3/userDataStream?listenKey=XXX |
| Cerrar | DELETE /api/v3/userDataStream?listenKey=XXX |
| Conectar WS | wss://stream.binance.com:9443/ws/<listenKey> |

Eventos recibidos por WS: `executionReport`, `outboundAccountPosition`, `balanceUpdate`

---

## 5) SPOT MARKET STREAMS (WEBSOCKET)

| Stream Name | Descripción |
|-------------|-------------|
| <symbol>@trade | Trade en tiempo real |
| <symbol>@aggTrade | Trade agregado |
| <symbol>@kline_1m | Velas en vivo |
| <symbol>@bookTicker | Mejor bid/ask |
| !miniTicker@arr | Ticker de todos |
| !bookTicker | Best bid/ask global |

Combinado:  
`wss://stream.binance.com:9443/stream?streams=btcusdt@trade/ethusdt@trade`

---

## 6) SAPI (DEPOSITOS / RETIROS / WALLET)

| Acción | Endpoint |
|--------|----------|
| Obtener dirección depósito | GET /sapi/v1/capital/deposit/address |
| Retiro | POST /sapi/v1/capital/withdraw/apply |
| Historial retiros | GET /sapi/v1/capital/withdraw/history |
| Config monedas/redes | GET /sapi/v1/capital/config/getall |
| Snapshot cuenta | GET /sapi/v1/accountSnapshot |

---

## 7) SAPI (MARGIN CROSS & ISOLATED)

| Acción | Endpoint |
|--------|----------|
| Comprar/Vender margen | POST /sapi/v1/margin/order |
| Pedir préstamo | POST /sapi/v1/margin/loan |
| Repagar préstamo | POST /sapi/v1/margin/repay |
| Máximo a pedir | GET /sapi/v1/margin/maxBorrowable |
| Info cuentas margen | GET /sapi/v1/margin/account |

---

## 8) FUTURES USDT-M (MARKET DATA)

| Endpoint | Descripción |
|----------|-------------|
| GET /fapi/v1/ping | Test |
| GET /fapi/v1/time | Hora |
| GET /fapi/v1/exchangeInfo | Símbolos y filtros |
| GET /fapi/v1/depth | Order book |
| GET /fapi/v1/trades | Trades |
| GET /fapi/v1/aggTrades | AggTrades |
| GET /fapi/v1/klines | Velas |
| GET /fapi/v1/premiumIndex | Mark Price |
| GET /fapi/v1/fundingRate | Funding histórico |

---

## 9) FUTURES USDT-M (TRADING PRIVADO)

| Acción | Endpoint |
|--------|----------|
| Crear orden | POST /fapi/v1/order |
| Obtener orden | GET /fapi/v1/order |
| Cancelar orden | DELETE /fapi/v1/order |
| Cancelar todas | DELETE /fapi/v1/allOpenOrders |
| Cambiar leverage | POST /fapi/v1/leverage |
| Cambiar marginType | POST /fapi/v1/marginType |
| Posiciones | GET /fapi/v2/positionRisk |
| Balances | GET /fapi/v1/balance |

---

## 10) FUTURES WEBSOCKET

| Tipo | URL |
|------|-----|
| Mercado | wss://fstream.binance.com/ws/<stream> |
| User Data | wss://fstream.binance.com/ws/<listenKey> |

Streams típicos:  
- `<symbol>@bookTicker`  
- `<symbol>@kline_1m`  
- `<symbol>@aggTrade`  
- `!ticker@arr`

User Data (tras crear listenKey vía `POST /fapi/v1/listenKey`) recibe eventos:  
`ORDER_TRADE_UPDATE`, `ACCOUNT_UPDATE`, `MARGIN_CALL`

---

## 11) ERRORES COMUNES

- `-1021` Timestamp fuera de rango → ajustar reloj
- `-2010` Filtro de símbolo (min qty, notional, price)
- `-2014 / -2015` Firma o API Key inválida → revisar HMAC
- `429` Rate limit → esperar / backoff
- `418` Banned temporalmente

---

## 12) EJEMPLOS RÁPIDOS (cURL)

### SPOT LIMIT BUY

```bash
APIKEY="X"
SECRET="Y"
QS="symbol=BTCUSDT&side=BUY&type=LIMIT&timeInForce=GTC&quantity=0.001&price=50000&timestamp=$(date +%s000)"
SIG=$(echo -n "$QS" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')
curl -H "X-MBX-APIKEY: $APIKEY" -X POST "https://api.binance.com/api/v3/order?$QS&signature=$SIG"
```

### FUTURES MARKET SELL

```bash
QS="symbol=BTCUSDT&side=SELL&type=MARKET&quantity=0.001&timestamp=$(date +%s000)"
SIG=$(echo -n "$QS" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')
curl -H "X-MBX-APIKEY: $APIKEY" -X POST "https://fapi.binance.com/fapi/v1/order?$QS&signature=$SIG"
```

---

FIN DEL BLOQUE
