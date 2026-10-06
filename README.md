# Say it with Quack 🦆💛

Estanque low poly con dos patos, hecho con Three.js.

## Estructura

- `apps/web`: Vite + Three.js + TypeScript (se despliega en Vercel)
- `apps/server`: servidor Go para websockets (se despliega en Railway)

## Desarrollo

```sh
pnpm install
pnpm dev          # web en http://localhost:5173 (y en tu IP local para el iPhone)
pnpm dev:server   # Go en http://localhost:8080 (/healthz)
```

## Despliegue

- **Web (Vercel):** se despliega sola con cada push a `main` → https://sayitwithquack.vercel.app (config en `vercel.json`).
- **Servidor (Railway):** `pnpm deploy:server` → https://server-production-20c4.up.railway.app/healthz (config en `apps/server/railway.toml`).

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
| `behaviors/swim.ts` | Nado (`Swimmer`) y coordinación de la pareja (`Couple`) |
| `ui/labels.ts` | Etiquetas HTML con CSS2DRenderer |
