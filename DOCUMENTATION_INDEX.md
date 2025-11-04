# 📚 Índice de Documentación - Trading Bot

## 🚀 Inicio Rápido

**Nuevo en el sistema?** Empieza aquí:

1. 📖 [`QUICK_START_AI.md`](./QUICK_START_AI.md) - **EMPEZAR AQUÍ**
   - Inicio en 30 segundos
   - Ejemplos básicos
   - Cómo ver los datos

2. 🤖 [`AI_SYSTEM_SUMMARY.md`](./AI_SYSTEM_SUMMARY.md) - Resumen ejecutivo
   - Qué hace el sistema
   - Features principales
   - Casos de uso

## 📖 Guías Principales

### Sistema de IA y Logs

3. 🧠 [`AI_LOGS_GUIDE.md`](./AI_LOGS_GUIDE.md) - **Guía completa para IA**
   - Estructura del JSON
   - Código Python completo
   - Estrategias de ejemplo
   - Análisis multi-timeframe
   - Integración con LLMs

4. 📁 [`LOGS_STRUCTURE.md`](./LOGS_STRUCTURE.md) - Estructura técnica
   - Organización de carpetas
   - Formato de archivos
   - Procesamiento de datos
   - Best practices

### WebSocket y Streaming

5. 🌐 [`WS_QUICK_START.md`](./WS_QUICK_START.md) - WebSocket básico
   - Cómo funciona el WebSocket
   - Configuración
   - Troubleshooting

6. 📡 [`AI_DATA_STREAMS.md`](./AI_DATA_STREAMS.md) - Streams de datos
   - Todos los streams disponibles
   - Qué datos trae cada uno
   - Referencias de Binance API

## 📂 Por Tema

### Para Desarrolladores

- **[`README.md`](./README.md)** - README principal del proyecto
  - Instalación
  - Scripts básicos
  - Estructura del código

### Para Trading

- Scripts de ejemplo en [`scripts/`](./scripts/)
  - `ws-futures-ai.ts` - Captura completa para IA
  - `live-scalping-backtest.ts` - Backtesting
  - `read-logs.ts` - Leer y analizar logs

### Para IA/ML

Orden recomendado de lectura:

1. **`QUICK_START_AI.md`** ← Empezar aquí
2. **`AI_LOGS_GUIDE.md`** ← Código y ejemplos
3. **`LOGS_STRUCTURE.md`** ← Detalles técnicos

## 🎯 Casos de Uso

### Quiero capturar datos para IA

1. Lee: [`QUICK_START_AI.md`](./QUICK_START_AI.md)
2. Ejecuta: `npm run ws:futures:5m`
3. Analiza con: [`AI_LOGS_GUIDE.md`](./AI_LOGS_GUIDE.md)

### Quiero analizar datos históricos

1. Usa: `npm run logs -- --timeframe=5m --stats`
2. O lee: [`LOGS_STRUCTURE.md`](./LOGS_STRUCTURE.md) para procesamiento avanzado

### Quiero crear un bot de trading

1. Lee: [`AI_LOGS_GUIDE.md`](./AI_LOGS_GUIDE.md) sección "Estrategias"
2. Usa los JSONs como señales
3. Implementa tu lógica de trading

### Quiero monitorear el mercado en tiempo real

1. Ejecuta: `npm run ws:futures:1m`
2. Monitorea: `tail -f logs/1m/market-data-BTCUSDT-*.jsonl | jq '.'`

## 📋 Comandos Más Usados

```bash
# Captura
npm run ws:futures:5m              # Un timeframe
npm run start:all                  # Todos los timeframes

# Análisis
npm run logs                       # Ver último registro
npm run logs -- --last=10          # Ver últimos 10
npm run logs -- --stats            # Estadísticas

# Control
npm run stop:all                   # Detener todo
```

## 🗺️ Mapa de Archivos

```
trading-bot/
├── 📖 QUICK_START_AI.md          ⭐ EMPEZAR AQUÍ
├── 🤖 AI_SYSTEM_SUMMARY.md       Resumen ejecutivo
├── 🧠 AI_LOGS_GUIDE.md           Guía completa para IA
├── 📁 LOGS_STRUCTURE.md          Estructura técnica
├── 🌐 WS_QUICK_START.md          WebSocket básico
├── 📡 AI_DATA_STREAMS.md         Streams disponibles
├── 📚 DOCUMENTATION_INDEX.md     Este archivo
│
├── scripts/
│   ├── ws-futures-ai.ts          💎 Script principal
│   ├── read-logs.ts              🔍 Leer logs
│   ├── start-all-timeframes.sh   🚀 Iniciar todos
│   └── stop-all-timeframes.sh    🛑 Detener todos
│
└── logs/                         📊 Datos generados
    ├── 1m/
    ├── 5m/
    ├── 15m/
    ├── 30m/
    ├── 1h/
    └── 4h/
```

## 💡 Tips Rápidos

✅ Para desarrollo: Usa `1m` para ver resultados rápido  
✅ Para producción: Usa `5m` + `1h` (balance datos/frecuencia)  
✅ Para análisis: Lee con `npm run logs -- --stats`  
✅ Para IA: Procesa todos los timeframes simultáneamente  
✅ Para alertas: Monitorea `1m` en tiempo real  

## 🆘 Ayuda

**¿Cómo empiezo?**  
→ [`QUICK_START_AI.md`](./QUICK_START_AI.md)

**¿Cómo uso los datos con Python/IA?**  
→ [`AI_LOGS_GUIDE.md`](./AI_LOGS_GUIDE.md)

**¿Cómo funciona técnicamente?**  
→ [`LOGS_STRUCTURE.md`](./LOGS_STRUCTURE.md)

**¿Problemas de conexión WebSocket?**  
→ [`WS_QUICK_START.md`](./WS_QUICK_START.md) sección Troubleshooting

---

**Sistema versión**: 3.0  
**Última actualización**: 2025-11-04  
**Mantenedor**: Bautista Badino

