import { defineConfig } from "vite";

export default defineConfig({
  server: {
    // Expone Vite en tu red local para abrirlo desde el iPhone.
    host: true,
    proxy: {
      // En local, /ws se redirige al servidor Go.
      "/ws": { target: "ws://localhost:8787", ws: true },
    },
  },
});
