#!/bin/bash

# Script para iniciar captura de datos en TODOS los timeframes simultáneamente
# Uso: ./scripts/start-all-timeframes.sh [SYMBOL]
# Ejemplo: ./scripts/start-all-timeframes.sh ETHUSDT

SYMBOL=${1:-BTCUSDT}

echo "🚀 Iniciando captura de datos para $SYMBOL en todos los timeframes..."
echo ""

# Compilar primero
echo "📦 Compilando..."
npm run build

echo ""
echo "✅ Lanzando procesos en background..."
echo ""

# Lanzar cada timeframe en background
echo "⏱️  1m  - Iniciando..."
node dist/scripts/ws-futures-ai.js --symbol=$SYMBOL --interval=1m > /dev/null 2>&1 &
PID_1M=$!
echo "   ✓ PID: $PID_1M"

echo "⏱️  5m  - Iniciando..."
node dist/scripts/ws-futures-ai.js --symbol=$SYMBOL --interval=5m > /dev/null 2>&1 &
PID_5M=$!
echo "   ✓ PID: $PID_5M"

echo "⏱️  15m - Iniciando..."
node dist/scripts/ws-futures-ai.js --symbol=$SYMBOL --interval=15m > /dev/null 2>&1 &
PID_15M=$!
echo "   ✓ PID: $PID_15M"

echo "⏱️  30m - Iniciando..."
node dist/scripts/ws-futures-ai.js --symbol=$SYMBOL --interval=30m > /dev/null 2>&1 &
PID_30M=$!
echo "   ✓ PID: $PID_30M"

echo "⏱️  1h  - Iniciando..."
node dist/scripts/ws-futures-ai.js --symbol=$SYMBOL --interval=1h > /dev/null 2>&1 &
PID_1H=$!
echo "   ✓ PID: $PID_1H"

echo "⏱️  4h  - Iniciando..."
node dist/scripts/ws-futures-ai.js --symbol=$SYMBOL --interval=4h > /dev/null 2>&1 &
PID_4H=$!
echo "   ✓ PID: $PID_4H"

echo ""
echo "✅ Todos los procesos iniciados!"
echo ""
echo "📊 Estructura de logs:"
echo "   logs/1m/market-data-$SYMBOL-$(date +%Y-%m-%d).jsonl"
echo "   logs/5m/market-data-$SYMBOL-$(date +%Y-%m-%d).jsonl"
echo "   logs/15m/market-data-$SYMBOL-$(date +%Y-%m-%d).jsonl"
echo "   logs/30m/market-data-$SYMBOL-$(date +%Y-%m-%d).jsonl"
echo "   logs/1h/market-data-$SYMBOL-$(date +%Y-%m-%d).jsonl"
echo "   logs/4h/market-data-$SYMBOL-$(date +%Y-%m-%d).jsonl"
echo ""
echo "🛑 Para detener todos los procesos:"
echo "   kill $PID_1M $PID_5M $PID_15M $PID_30M $PID_1H $PID_4H"
echo ""
echo "   O ejecuta: ./scripts/stop-all-timeframes.sh"
echo ""

# Guardar PIDs en archivo para poder detener después
echo "$PID_1M" > /tmp/trading-bot-pids-$SYMBOL.txt
echo "$PID_5M" >> /tmp/trading-bot-pids-$SYMBOL.txt
echo "$PID_15M" >> /tmp/trading-bot-pids-$SYMBOL.txt
echo "$PID_30M" >> /tmp/trading-bot-pids-$SYMBOL.txt
echo "$PID_1H" >> /tmp/trading-bot-pids-$SYMBOL.txt
echo "$PID_4H" >> /tmp/trading-bot-pids-$SYMBOL.txt

echo "💾 PIDs guardados en: /tmp/trading-bot-pids-$SYMBOL.txt"
echo ""
echo "🔍 Ver logs en tiempo real:"
echo "   tail -f logs/1m/market-data-$SYMBOL-$(date +%Y-%m-%d).jsonl"
echo ""
echo "📈 Monitorear todos los timeframes:"
echo "   watch -n 5 'wc -l logs/*/market-data-$SYMBOL-$(date +%Y-%m-%d).jsonl'"
echo ""

