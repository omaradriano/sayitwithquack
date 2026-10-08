import { defineConfig } from "vite";

// Puertos propios para no chocar con otros proyectos (5173 / 8080 ya están ocupados).
const WEB_PORT = 5391;
const SERVER_PORT = 8791; // debe coincidir con el default de apps/server/cmd/server/main.go

export default defineConfig({
  server: {
    port: WEB_PORT,
    strictPort: true, // si el puerto está ocupado, falla en vez de usar otro
    // Expone Vite en tu red local para abrirlo desde el iPhone.
    host: true,
    proxy: {
      // En local, /ws se redirige al servidor Go.
      "/ws": { target: `ws://localhost:${SERVER_PORT}`, ws: true },
    },
  },
  preview: { port: WEB_PORT, strictPort: true },
});
