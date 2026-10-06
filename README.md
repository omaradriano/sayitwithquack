# Say it with Quack 🦆💛

Estanque low poly con dos patos, hecho con Three.js.

## Estructura

- `apps/web`: Vite + Three.js + TypeScript (se despliega en Vercel)
- `apps/server`: servidor Go para websockets (se despliega en Railway)

## Desarrollo

```sh
pnpm install
pnpm dev          # web en http://localhost:5173 (y en tu IP local para el iPhone)
pnpm dev:server   # Go en http://localhost:8787 (/healthz y /ws)
```

## Despliegue

- **Web (Vercel):** se despliega sola con cada push a `main` → https://sayitwithquack.vercel.app (config en `vercel.json`).
- **Servidor (Railway):** `pnpm deploy:server` → https://server-production-20c4.up.railway.app/healthz (config en `apps/server/railway.toml`).

Variables de entorno:

| Dónde | Variable | Valor |
| --- | --- | --- |
| Vercel | `VITE_WS_URL` | `wss://server-production-20c4.up.railway.app/ws` |
| Railway | `ALLOWED_ORIGINS` | `sayitwithquack.vercel.app,sayitwithquack-*.vercel.app` |
| Railway | `DUCK_IDS` (opcional) | `omar,mayra` |

## Uso

- Al entrar se pide el código secreto (`SECRET_CODES` en `apps/web/src/config.ts`) y se recuerda en localStorage.
- Abre la app con `#salir` al final de la URL para olvidar el pato guardado.
- Toca y arrastra en cualquier parte para mover a tu pato; tu pareja lo ve en vivo.

Personaliza nombres y colores de los patos en `apps/web/src/config.ts`.

## Mapa del código (web)

| Archivo | Qué hace |
| --- | --- |
| `core/renderer.ts` | Crea el WebGLRenderer (pixel ratio limitado a 2, sombras) |
| `core/camera.ts` | Cámara 3/4 encuadrada según el aspecto de la pantalla |
| `core/screen.ts` | `screenToWater`: punto de pantalla → punto en el agua (raycast) |
| `core/loop.ts` | Loop de animación; todo lo animado implementa `tick()` |
| `world/pond.ts` | Agua low poly con ondas (`waveHeight`) |
| `world/duck.ts` | Pato hecho de cajas |
| `world/decor.ts` | Nenúfares, juncos y rocas colocados en posiciones de pantalla |
| `behaviors/swim.ts` | Nado en modos auto / manual / remote (`Swimmer`) y la pareja (`Couple`) |
| `ui/labels.ts` | Etiquetas HTML con CSS2DRenderer (+ indicador "en control") |
| `ui/login.ts` | Pantalla del código secreto |
| `ui/joystick.ts` | Joystick flotante que aparece donde tocas |
| `ui/presence.ts` | Aviso de si tu pareja está conectada |
| `session.ts` | Sesión en localStorage |
| `net/protocol.ts` | Mensajes del websocket (espejo de `apps/server/internal/protocol`) |
| `net/connection.ts` | WebSocket con reconexión automática |
