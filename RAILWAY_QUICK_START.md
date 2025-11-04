# 🚂 Railway - Guía Rápida

## ✅ Estado: LISTO PARA DEPLOYAR

El proyecto ya está configurado y probado localmente. Todo funciona correctamente.

## 📋 Pasos para Deployar

### 1. Hacer commit y push de los cambios

```bash
git add .
git commit -m "Add Express API server with logs endpoints"
git push
```

### 2. Deployar en Railway

1. Ve a [railway.app](https://railway.app)
2. Click en "New Project"
3. Click en "Deploy from GitHub repo"
4. Selecciona tu repositorio `Trading-Agent`
5. Railway detectará automáticamente `railway.json` y `nixpacks.toml`
6. El build se ejecutará automáticamente:
   - Instalará dependencias: `npm ci`
   - Compilará TypeScript: `npm run build`
   - Iniciará el servidor: `npm start`

### 3. Verificar el Deployment

Railway te dará una URL como:
```
https://trading-agent-production.up.railway.app
```

Prueba los endpoints:

```bash
# Health check
curl https://tu-url.railway.app/health

# Ver información de la API
curl https://tu-url.railway.app/

# Ver logs de 1m
curl https://tu-url.railway.app/api/logs?timeframe=1m&limit=5

# Ver estadísticas
curl https://tu-url.railway.app/api/logs/stats
```

## 🔧 Configuración de Railway

**Variables de entorno** (opcional, solo si necesitas credenciales de Binance):
- `BINANCE_API_KEY` - Tu API key de Binance
- `BINANCE_API_SECRET` - Tu API secret de Binance

**Puerto**: Railway automáticamente asigna el puerto y lo inyecta en `process.env.PORT`

## 📊 Iniciar Collectors en Railway

Una vez deployado, puedes iniciar collectors remotamente:

```bash
# Iniciar collector de 1m para ETHUSDT
curl -X POST https://tu-url.railway.app/api/collectors/start \
  -H "Content-Type: application/json" \
  -d '{"timeframe": "1m", "symbol": "ETHUSDT"}'

# Iniciar collector de 5m para BTCUSDT
curl -X POST https://tu-url.railway.app/api/collectors/start \
  -H "Content-Type: application/json" \
  -d '{"timeframe": "5m", "symbol": "BTCUSDT"}'
```

## 📦 Almacenamiento de Logs

**IMPORTANTE**: Railway usa volúmenes efímeros por defecto. Los logs se perderán al reiniciar.

### Opción 1: Volumen Persistente (Requiere plan de pago)
1. Railway → Settings → Volumes → Add Volume
2. Mount path: `/app/logs`

### Opción 2: Base de Datos (Recomendado para producción)
- Considera agregar PostgreSQL o MongoDB
- Modificar los collectors para guardar en DB en lugar de archivos

### Opción 3: Storage Externo (S3, Google Cloud Storage)
- Crear script que suba logs periódicamente
- Usar AWS S3, Google Cloud Storage, o similar

## 🎯 Endpoints Disponibles

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/health` | GET | Health check del servidor |
| `/` | GET | Información de la API |
| `/api/logs` | GET | Obtener logs filtrados |
| `/api/logs/files` | GET | Listar archivos disponibles |
| `/api/logs/stats` | GET | Estadísticas de logs |
| `/api/collectors/start` | POST | Iniciar un collector |

## 🌐 Usar desde Frontend

```javascript
const API_URL = 'https://tu-url.railway.app';

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

## 🐛 Troubleshooting

### El build falla
- Revisa los logs de build en Railway
- Verifica que todas las dependencias estén en `package.json`
- Asegúrate de que TypeScript compile sin errores

### El servidor no responde
- Verifica los logs del servicio en Railway
- Asegúrate de que el puerto sea el correcto (Railway usa `process.env.PORT`)
- Verifica que no haya errores en tiempo de ejecución

### Los logs no se guardan
- Railway usa volúmenes efímeros
- Considera agregar un volumen persistente o usar una base de datos

## 📚 Más Info

- Documentación completa: [`DEPLOYMENT.md`](./DEPLOYMENT.md)
- Guía de logs para IA: [`AI_LOGS_GUIDE.md`](./AI_LOGS_GUIDE.md)
- Estructura del proyecto: [`README.md`](./README.md)

