# 🔧 Fixes para Deployment - Railway/Production

## ❌ Problemas Encontrados

### 1. Error P2002: Unique Constraint Failed on PID
```
PrismaClientKnownRequestError:
Unique constraint failed on the fields: (`pid`)
```

**Causa:** Intentaba crear collectors con PIDs que ya existían en la BD.

**Solución:** Cambié `create` por `upsert` en `CollectorDatabaseService.saveCollector()`:

```typescript
// ANTES
await prisma.collector.create({ data })  // ❌ Falla si PID existe

// AHORA
await prisma.collector.upsert({          // ✅ Actualiza si existe
  where: { pid },
  update: { ...data, stoppedAt: null },  // Reset stoppedAt
  create: { ...data }
})
```

---

### 2. Collectors No Guardaban en PostgreSQL

**Causa:** Los procesos `spawn()` no recibían las variables de entorno (`DATABASE_URL`).

**Solución:** Agregado `env: { ...process.env }` al spawn:

```typescript
spawn('node', [...args], {
  detached: true,
  stdio: 'ignore',
  env: {
    ...process.env,  // ✅ Incluye DATABASE_URL
    NODE_ENV: process.env.NODE_ENV || 'production'
  }
})
```

---

### 3. Collectors Muertos en la BD

**Causa:** Al reiniciar el servidor, quedaban PIDs que ya no existen.

**Solución:** Limpieza automática al iniciar el servidor:

```typescript
app.listen(PORT, async () => {
  console.log('🚀 Servidor iniciado');
  
  // Limpiar collectors muertos
  await cleanupDeadCollectors();
  console.log('✅ Limpieza completada');
});
```

---

## ✅ Todos los Fixes Aplicados

```
✅ CollectorDatabaseService.saveCollector() - Usa upsert
✅ spawn() con env variables - Pasa DATABASE_URL
✅ Limpieza al inicio - Marca collectors muertos como stopped
✅ Código recompilado sin errores
```

---

## 🚀 Deploy a Railway - Pasos

### 1. Commit y Push

```bash
cd /Users/bautistabadino/Repos/Trading-Botardo/trading-bot-api

git add .
git commit -m "fix: collectors save to PostgreSQL + handle duplicate PIDs"
git push origin main
```

### 2. Variables de Entorno en Railway

Verifica que estén configuradas en Railway:

```
✅ DATABASE_URL=prisma+postgres://accelerate.prisma-data.net/?api_key=eyJ...
✅ DIRECT_DATABASE_URL=postgresql://6f730d14...@db.prisma.io:5432/postgres?sslmode=require
✅ PORT=8080 (o el que Railway asigne)
✅ NODE_ENV=production
```

### 3. Esperar Deploy

Railway hará deploy automáticamente. Verás en los logs:

```
✅ Servidor API corriendo en puerto 8080
✅ Limpieza de collectors completada
```

### 4. Probar desde el Frontend

1. Ve a `/collectors`
2. Inicia un collector (1m, ETHUSDT)
3. Espera 1-2 minutos
4. Ve a `/logs`
5. Deberías ver datos aparecer

---

## 🧪 Verificar que Funciona

### Test Local (Antes de Deploy)

```bash
# Iniciar servidor local
npm start

# En otra terminal, probar guardar datos
npm run test:db

# Debería mostrar:
✓ Total de market data: 5 (o más)
```

### Test en Railway

```bash
# Ver logs en tiempo real
railway logs --follow

# O desde la UI de Railway, sección Logs

# Deberías ver cada minuto:
✅ Guardado en PostgreSQL (ETHUSDT 1m)
```

---

## 🔍 Debugging

### Si los collectors siguen sin guardar:

**1. Verificar que DATABASE_URL esté en Railway:**
```bash
railway variables
# Buscar: DATABASE_URL
```

**2. Ver logs del collector:**
```bash
railway logs --filter="Guardado en PostgreSQL"
```

**3. Verificar tabla en Prisma Studio:**
```bash
npm run prisma:studio
# Ir a tabla market_data
# Deberían aparecer registros nuevos cada minuto
```

**4. Test manual de guardado:**
```bash
node dist/scripts/test-save-market-data.js
# Debería guardar exitosamente
```

---

## ⚠️ Checklist Pre-Deploy

```
✅ Código compilado sin errores (npm run build)
✅ Test de conexión pasando (npm run test:db)
✅ Test de guardado pasando (test-save-market-data.js)
✅ Variables de entorno en .env local
✅ Variables de entorno configuradas en Railway
✅ Git commit y push realizados
✅ Collectors viejos detenidos
```

---

## 📊 Después del Deploy

### Verificación Paso a Paso:

**1. Verificar servidor levantó:**
```bash
curl https://tu-api.railway.app/health

# Respuesta esperada:
{
  "status": "ok",
  "timestamp": "...",
  "uptime": 123
}
```

**2. Iniciar collector desde frontend:**
```bash
# Desde la UI de /collectors
# O con curl:
curl -X POST https://tu-api.railway.app/api/collectors/start \
  -H "Content-Type: application/json" \
  -d '{"timeframe":"1m","symbol":"ETHUSDT"}'
```

**3. Esperar 1-2 minutos**

**4. Verificar datos:**
```bash
curl "https://tu-api.railway.app/api/logs?symbol=ETHUSDT&timeframe=1m&limit=10"

# Debería retornar registros
```

---

## 🎯 Resultado Esperado

Después del deploy y de iniciar un collector:

**En Railway Logs:**
```
✅ Servidor API corriendo en puerto 8080
✅ Limpieza de collectors completada
✅ Conectado a Binance Futures WebSocket
✅ Indicadores inicializados
...
✅ Guardado en PostgreSQL (ETHUSDT 1m)  ← Cada minuto
```

**En Frontend `/logs`:**
```
Tabla con registros de market data ✅
Timestamp, Precio, RSI, Presión, etc. ✅
```

**En Prisma Studio:**
```
market_data table con registros incrementando ✅
```

---

## 🔑 Key Points

1. **UPSERT en lugar de CREATE** - Evita errores de PIDs duplicados
2. **ENV vars en spawn()** - Collectors pueden acceder a DATABASE_URL
3. **Limpieza al inicio** - Marca collectors muertos automáticamente
4. **stdio: 'ignore'** - Los collectors corren en background sin bloquear

---

**Estado:** ✅ Listo para deploy  
**Fixes:** 3 problemas críticos resueltos  
**Tests:** Todos pasando localmente

