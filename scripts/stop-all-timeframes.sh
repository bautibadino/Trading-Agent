#!/bin/bash

# Script para detener todos los procesos de captura de datos
# Uso: ./scripts/stop-all-timeframes.sh [SYMBOL]

SYMBOL=${1:-BTCUSDT}
PID_FILE="/tmp/trading-bot-pids-$SYMBOL.txt"

echo "🛑 Deteniendo procesos de captura para $SYMBOL..."
echo ""

if [ ! -f "$PID_FILE" ]; then
  echo "❌ No se encontró archivo de PIDs: $PID_FILE"
  echo ""
  echo "💡 Procesos de Node.js corriendo:"
  ps aux | grep "ws-futures-ai.js" | grep -v grep
  exit 1
fi

# Leer PIDs y matar procesos
while read pid; do
  if ps -p $pid > /dev/null 2>&1; then
    echo "   Deteniendo proceso $pid..."
    kill $pid 2>/dev/null
    echo "   ✓ Proceso $pid detenido"
  else
    echo "   ⚠️  Proceso $pid ya no existe"
  fi
done < "$PID_FILE"

# Limpiar archivo de PIDs
rm -f "$PID_FILE"

echo ""
echo "✅ Todos los procesos detenidos"
echo ""

# Mostrar resumen de logs
echo "📊 Resumen de datos capturados:"
for timeframe in 1m 5m 15m 30m 1h 4h; do
  LOG_FILE="logs/$timeframe/market-data-$SYMBOL-$(date +%Y-%m-%d).jsonl"
  if [ -f "$LOG_FILE" ]; then
    LINES=$(wc -l < "$LOG_FILE")
    echo "   $timeframe: $LINES registros"
  fi
done
echo ""

