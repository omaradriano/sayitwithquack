# Say it with Quack

Detalle para Mayra: un estanque low poly a pantalla completa con dos patos (Omar y Mayra) que nadan solos y se pueden mover en vivo entre los dos teléfonos. También es el proyecto de aprendizaje de Three.js de Omar: explica los conceptos de Three.js al introducirlos y avanza paso a paso.

## Reglas

- **Commits sin atribución:** no agregues `Co-Authored-By: Claude ...` ni ninguna otra línea de atribución a Claude en commits ni PRs.
- Haz commit, push o despliegue solo cuando Omar lo pida. Primero se prueba en dev y él avisa cuándo desplegar.
- Textos de la UI y comentarios del código en español.
- Objetivo principal: iPhone SE (375x667, vertical). Revisa siempre a ese tamaño.

## Stack y estructura

Monorepo pnpm (`pnpm-workspace.yaml`):

- `apps/web`: Vite + Three.js + TypeScript (sin framework). Se despliega en Vercel.
- `apps/server`: Go con `net/http` y `github.com/coder/websocket`. Se despliega en Railway (Dockerfile).
- `apps/web/src/net/protocol.ts` y `apps/server/internal/protocol/protocol.go` son espejo: si cambias uno, cambia el otro.

Mapa del código web en `README.md`. Piezas clave:

- `config.ts`: patos (id, nombre, colores), `SECRET_CODES`, área de nado `POND`, `WS_URL`.
- `core/loop.ts`: todo lo animado implementa `tick(delta, elapsed)` y se registra con `loop.add()`.
- `behaviors/swim.ts`: `Swimmer` con modos `auto` (nada solo), `manual` (joystick) y `remote` (lo mueve el otro teléfono); `Couple` evita que se encimen y a veces nadan juntos.
- `ui/labels.ts`: `DuckLabel` rota cada 5 s entre nombre → "en línea" / "visto hoy 2:32 p.m." → mensaje personalizado (se salta las fases vacías).
- `ui/settings.ts`: menú ☰ (va en `<body>`, fuera de `#app`, para no activar el joystick). Cada quien configura solo su pato: colores (cuerpo, alas, cabeza) con vista previa local y mensaje de máx. 60 caracteres. Se envía al pulsar "Guardar configuración"; si cierras sin guardar, se revierte.
- `world/duck.ts`: cada pato tiene sus propios materiales de cuerpo, alas y cabeza (`setColors`); pico y ojos son compartidos.

## Cómo funciona el tiempo real

- **Cada cliente es dueño de su pato:** lo simula y manda `{t:"state", x, z, h, s, m}` cada 100 ms. El pato de la pareja se dibuja con lo que llega, extrapolando entre mensajes; si no llegan datos por más de 0.4 s, frena.
- **Servidor Go = relay:** el primer mensaje es `hello` con el id del pato. El servidor reenvía estados y configuraciones (`config`), avisa quién está (`welcome` / `presence` con `online` y `lastSeen`) y guarda el último estado de cada pato para que al recargar continúe donde estaba. Valida colores `#rrggbb` y recorta el mensaje a 60 caracteres. Si se conecta el mismo pato dos veces, la conexión nueva reemplaza a la vieja (cierre con razón `replaced`).
- **Seguridad:** el servidor solo acepta websockets de orígenes permitidos (localhost, 127.0.0.1, 192.168.* y `ALLOWED_ORIGINS`). Los códigos secretos están en `config.ts` por decisión de Omar: viajan en el JS publicado, sirven para identificar el pato, no como contraseña real.
- **Persistencia:** `internal/store` guarda `state.json` (configs, lastSeen y últimas posiciones) en `DATA_DIR` con escritura atómica. Se escribe al guardar una configuración y cuando alguien se desconecta. En local es `apps/server/data/` (ignorado en git); en Railway, un volumen montado en `/data`.
- **Cerrar sesión:** abrir la app con `#salir` borra la sesión de localStorage.

## Desarrollo

```sh
pnpm dev          # Vite en :5173 (usar http://127.0.0.1:5173; otra app de Omar ocupa localhost:5173)
pnpm dev:server   # Go en :8787 (8080 lo ocupa otro proyecto). Vite hace proxy de /ws a :8787
pnpm typecheck
pnpm build
```

- En desarrollo, `window.scene`, `window.camera` y `window.swimmers` sirven para depurar desde la consola.
- Para probar dos patos a la vez, usa dos contextos de navegador separados (incógnito o playwright), porque la sesión vive en localStorage.
- El Chrome automatizado necesita aceleración por hardware activada para WebGL; en headless usa `--use-angle=swiftshader --enable-unsafe-swiftshader`.

## Despliegue

| | URL | Cómo |
| --- | --- | --- |
| Web (Vercel) | https://sayitwithquack.vercel.app | Automático con push a `main` (config en `vercel.json`) |
| Server (Railway) | https://server-production-20c4.up.railway.app | `pnpm deploy:server` (config en `apps/server/railway.toml`, healthcheck `/healthz`) |

- **Variables de entorno:** Vercel `VITE_WS_URL=wss://server-production-20c4.up.railway.app/ws`; Railway `ALLOWED_ORIGINS=sayitwithquack.vercel.app,sayitwithquack-*.vercel.app` y `DATA_DIR=/data` (con volumen en `/data`).
- **Orden de despliegue:** si cambia el protocolo, despliega primero el servidor y luego haz push de la web. Mantén los cambios del protocolo compatibles hacia atrás (campos nuevos opcionales).
- **Repo:** GitHub privado `omaradriano/sayitwithquack`.

## Historial

1. Base: monorepo, agua low poly con ondas, patos de cajas, decoración, etiquetas, cámara 3/4 para iPhone SE.
2. Despliegue en Vercel + Railway.
3. Websockets: código secreto + sesión en localStorage, joystick flotante, movimiento en vivo con indicador "🕹️ en control", presencia.
4. Mensaje de bienvenida personalizado en el login.
5. Etiquetas que alternan nombre ↔ "en línea" / "visto …" (última conexión).
6. Menú ☰ de configuración: colores del pato y mensaje personalizado, persistidos en un archivo JSON.

## Ideas pendientes

- Despliegue automático del servidor: conectar el repo en Railway con Root Directory `/apps/server`.
- Más acciones en vivo (quack, corazones, etc.).
