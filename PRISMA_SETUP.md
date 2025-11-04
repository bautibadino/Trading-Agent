# 🗄️ Configuración de Prisma Accelerate

Este proyecto utiliza **Prisma Accelerate** para escalar la base de datos PostgreSQL con conexión global de baja latencia y caché.

## 📋 Configuración Actual

### Variables de Entorno

El archivo `.env` contiene dos URLs importantes:

```env
# Para queries (usado por la aplicación)
DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=YOUR_API_KEY"

# Para migraciones y schema push (conexión directa)
DIRECT_DATABASE_URL="postgresql://usuario:password@db.prisma.io:5432/postgres?sslmode=require"
```

### Schema de Base de Datos

El proyecto tiene 3 tablas principales:

1. **collectors** - Gestión de procesos collectors
   - `pid`: Process ID del collector
   - `timeframe`: Intervalo de tiempo (1m, 5m, 15m, 30m, 1h, 4h)
   - `symbol`: Par de trading (ETHUSDT, BTCUSDT, etc)
   - `status`: Estado (running, stopped, error)
   - `startedAt`: Timestamp de inicio
   - `stoppedAt`: Timestamp de detención

2. **candles** - Datos de velas (OHLCV)
   - `symbol`, `timeframe`, `openTime`, `closeTime`
   - `open`, `high`, `low`, `close`, `volume`

3. **trades** - Registro de operaciones
   - `symbol`, `side` (BUY/SELL)
   - `entryPrice`, `exitPrice`, `quantity`
   - `profit`, `profitPercent`
   - `entryTime`, `exitTime`, `status`

## 🚀 Scripts Disponibles

```bash
# Generar cliente de Prisma
npm run prisma:generate

# Sincronizar schema con BD (sin migraciones)
npm run prisma:push

# Abrir Prisma Studio (GUI para ver datos)
npm run prisma:studio

# Crear una migración
npm run prisma:migrate
```

## 🔧 Cómo Funciona

### Prisma Accelerate

Prisma Accelerate actúa como un proxy entre tu aplicación y la base de datos:

```
[Tu App] → [Prisma Accelerate] → [PostgreSQL]
            ↓
         [Cache Global]
```

**Beneficios:**
- ✅ Conexión global de baja latencia
- ✅ Cache automático de queries
- ✅ Reducción de conexiones a la BD
- ✅ Escalabilidad automática

### Cliente de Prisma

El cliente está configurado en `src/config/prisma.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

export const prisma = new PrismaClient().$extends(withAccelerate());
```

### Servicio de Collectors

El servicio `CollectorDatabaseService` (`src/server/services/CollectorDatabaseService.ts`) proporciona métodos para:

- `saveCollector()` - Guardar nuevo collector
- `getCollectors()` - Obtener collectors activos
- `getCollectorsWithUptime()` - Obtener con uptime calculado
- `stopCollector()` - Detener collector
- `isPidAlive()` - Verificar si un PID existe
- `cleanupOldCollectors()` - Limpiar collectors antiguos

## 📡 Endpoints API

### GET /api/collectors/status
Obtiene el estado de todos los collectors:

```bash
curl http://localhost:3000/api/collectors/status
```

**Respuesta:**
```json
{
  "collectors": [
    {
      "pid": 12345,
      "timeframe": "1m",
      "symbol": "ETHUSDT",
      "status": "running",
      "startedAt": "2025-11-04T10:00:00.000Z",
      "uptime": 3600
    }
  ]
}
```

### POST /api/collectors/start
Inicia un nuevo collector:

```bash
curl -X POST http://localhost:3000/api/collectors/start \
  -H "Content-Type: application/json" \
  -d '{"timeframe":"1m","symbol":"ETHUSDT"}'
```

### POST /api/collectors/stop
Detiene un collector específico:

```bash
curl -X POST http://localhost:3000/api/collectors/stop \
  -H "Content-Type: application/json" \
  -d '{"pid":12345}'
```

## 🔐 Seguridad

- El archivo `.env` está en `.gitignore` (no se sube al repositorio)
- Las API keys están encriptadas en la URL de Accelerate
- Solo se pueden detener collectors registrados en la BD

## 🛠️ Desarrollo

### Ver datos en tiempo real

```bash
npm run prisma:studio
```

Esto abre una interfaz web en `http://localhost:5555` donde puedes:
- Ver todas las tablas
- Editar registros
- Ejecutar filtros
- Ver relaciones

### Modificar el Schema

1. Edita `prisma/schema.prisma`
2. Ejecuta `npm run prisma:push` para sincronizar
3. El cliente se regenera automáticamente

### Ejemplo de uso directo

```typescript
import { prisma } from './config/prisma.js';

// Crear un collector
await prisma.collector.create({
  data: {
    pid: 12345,
    timeframe: '1m',
    symbol: 'ETHUSDT',
    status: 'running'
  }
});

// Buscar collectors activos
const collectors = await prisma.collector.findMany({
  where: { status: 'running' }
});

// Actualizar estado
await prisma.collector.update({
  where: { pid: 12345 },
  data: { status: 'stopped' }
});
```

## 📊 Performance con Accelerate

Prisma Accelerate cachea automáticamente queries repetidas:

```typescript
// Esta query será cacheada
const collectors = await prisma.collector.findMany({
  cacheStrategy: { ttl: 60 } // Cache por 60 segundos
});
```

## 🚨 Troubleshooting

### Error: "waiting query"
- Verifica que `DATABASE_URL` esté correctamente configurada
- Comprueba que la API key sea válida
- Asegúrate de que `DIRECT_DATABASE_URL` tenga el formato correcto

### Error: "bad certificate format"
- Cambia `postgres://` por `postgresql://` en `DIRECT_DATABASE_URL`
- Verifica que `sslmode=require` esté presente

### Collectors no persisten
- Verifica que la tabla `collectors` exista: `npm run prisma:studio`
- Comprueba los logs del servidor para errores de BD
- Asegúrate de que el servicio use `CollectorDatabaseService` (no el antiguo `CollectorStateService`)

## 📚 Referencias

- [Prisma Accelerate Docs](https://www.prisma.io/docs/accelerate)
- [Prisma Client API](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference)
- [PostgreSQL Connection Strings](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING)

