# 🚀 Guía de Deployment

Esta guía explica cómo deployar el Trading Bot en diferentes plataformas para que funcione 24/7.

## 📋 Requisitos Previos

- Repositorio en GitHub/GitLab
- Cuenta en Railway (o la plataforma que elijas)
- Node.js 22 en producción

## 🚂 Deployment en Railway

### Paso 1: Crear Proyecto en Railway

1. Ve a [railway.app](https://railway.app) y crea una cuenta
2. Click en "New Project" → "Deploy from GitHub repo"
3. Selecciona tu repositorio `trading-bot`

### Paso 2: Configurar Variables de Entorno (Opcional)

Si necesitas credenciales de Binance API, añade en Railway:
- `BINANCE_API_KEY` (opcional, solo para endpoints firmados)
- `BINANCE_API_SECRET` (opcional, solo para endpoints firmados)

### Paso 3: Railway Detectará Automáticamente

Railway usará el archivo `railway.json` que configura:
- **Build**: `npm run build` (compila TypeScript)
- **Start**: `npm start` (ejecuta el servidor API)

### Paso 4: Verificar Deployment

Una vez deployado, Railway te dará una URL como:
```
https://trading-bot-production.up.railway.app
```

Verifica que funciona:
```bash
curl https://tu-url.railway.app/health
```

Deberías ver:
```json
{
  "status": "ok",
  "timestamp": "2025-11-04T...",
  "uptime": 123.45
}
```

### Paso 5: Iniciar Collectors

Una vez deployado, puedes iniciar collectors desde el frontend o con curl:

```bash
# Iniciar collector de 1m
curl -X POST https://tu-url.railway.app/api/collectors/start \
  -H "Content-Type: application/json" \
  -d '{"timeframe": "1m", "symbol": "ETHUSDT"}'

# Iniciar collector de 5m
curl -X POST https://tu-url.railway.app/api/collectors/start \
  -H "Content-Type: application/json" \
  -d '{"timeframe": "5m", "symbol": "ETHUSDT"}'
```

## 🔌 API Endpoints Disponibles

Una vez deployado, tienes estos endpoints:

### Health Check
```
GET /health
```
Verifica que el servidor está corriendo.

### Obtener Logs
```
GET /api/logs?timeframe=1m&symbol=ETHUSDT&limit=100&date=2025-11-04
```
- `timeframe`: 1m, 5m, 15m, 30m, 1h, 4h
- `symbol`: BTCUSDT, ETHUSDT, etc.
- `limit`: Número de logs a retornar (default: 100)
- `date`: Fecha específica (opcional)

### Listar Archivos
```
GET /api/logs/files?timeframe=1m
```
Lista todos los archivos disponibles con tamaño y fecha.

### Estadísticas
```
GET /api/logs/stats
```
Estadísticas de todos los timeframes (total de archivos, tamaño, líneas).

### Iniciar Collector
```
POST /api/collectors/start
Body: { "timeframe": "1m", "symbol": "ETHUSDT" }
```

## 🌐 Usar desde Frontend

Ejemplo con fetch:

```javascript
// Obtener logs
const response = await fetch('https://tu-url.railway.app/api/logs?timeframe=1m&symbol=ETHUSDT&limit=50');
const data = await response.json();
console.log(data.logs);

// Iniciar collector
await fetch('https://tu-url.railway.app/api/collectors/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ timeframe: '1m', symbol: 'ETHUSDT' })
});

// Obtener estadísticas
const stats = await fetch('https://tu-url.railway.app/api/logs/stats').then(r => r.json());
console.log(stats);
```

## 📦 Almacenamiento de Logs

**IMPORTANTE**: Railway usa volúmenes efímeros. Los logs se pierden al reiniciar el servicio.

### Opciones para Persistencia:

1. **Volumen Persistente en Railway** (requiere plan de pago)
   - Railway → Settings → Volumes → Add Volume
   - Monta en `/app/logs`

2. **Storage Externo** (Recomendado)
   - Subir logs a S3/Google Cloud Storage periódicamente
   - O usar una base de datos (PostgreSQL, MongoDB)

3. **Script de Backup**
   - Crear script que suba logs periódicamente a un servicio externo

## 🔄 Deployment en Otras Plataformas

### Render.com

1. Conecta tu repo
2. Build Command: `npm run build`
3. Start Command: `npm start`
4. **Nota**: Render duerme servicios gratis después de 15min de inactividad

### Fly.io

```bash
# Instalar flyctl
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Crear app
fly launch

# Deploy
fly deploy
```

### VPS (DigitalOcean, Vultr, etc.)

```bash
# SSH al servidor
ssh user@tu-servidor

# Instalar Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar PM2
sudo npm install -g pm2

# Clonar repo
git clone tu-repo-url ~/trading-bot
cd ~/trading-bot
npm install
npm run build

# Iniciar con PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 🐛 Troubleshooting

### Error: Cannot find module '/app/dist/index.js'

**Causa**: El build no se ejecutó correctamente.

**Solución**: 
- Verifica que `railway.json` tenga el buildCommand correcto
- Revisa los logs de build en Railway
- Asegúrate de que `package.json` tenga el script `build`

### El servidor no inicia

**Causa**: Puerto no configurado o conflicto.

**Solución**:
- Railway automáticamente inyecta `PORT` en variables de entorno
- El código ya usa `process.env.PORT || 3000`

### Los logs no se guardan

**Causa**: Railway usa volúmenes efímeros.

**Solución**: Usa un volumen persistente o storage externo.

### Los collectors no inician

**Causa**: El proceso se detiene o falta memoria.

**Solución**:
- Verifica logs en Railway
- Considera usar un worker separado para collectors
- Usa PM2 o similar para manejar procesos

## 📝 Notas

- El servidor API expone los logs guardados localmente
- Los collectors pueden iniciarse via API pero se recomienda usar PM2 o similar en producción
- Para producción seria, considera separar el API server de los collectors en servicios diferentes
- Los logs ocupan espacio, monitorea el uso de disco
