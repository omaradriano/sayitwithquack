/** Personaliza aquí a los patos. El id debe coincidir con DUCK_IDS del servidor. */
export const DUCKS = [
  { id: "omar", name: "Omar", body: "#8b6a4e", wing: "#6f533c", head: "#2f6b4a" },
  { id: "mayra", name: "Mayra", body: "#f6f1e4", wing: "#e3dac5", head: "#f6f1e4" },
] as const;

export type DuckId = (typeof DUCKS)[number]["id"];

/**
 * Código secreto de cada pato. Ojo: esto viaja en el JavaScript publicado,
 * así que sirve para "saber quién eres", no como contraseña de verdad.
 */
export const SECRET_CODES: Record<DuckId, string> = {
  omar: "chavito2",
  mayra: "chavito1",
};

/** Área donde nadan los patos (coordenadas del mundo, centrada en 0,0). Igual en todos los dispositivos. */
export const POND = { halfWidth: 2.0, halfDepth: 2.9 };

/** En local "/ws" pasa por el proxy de Vite; en Vercel se define VITE_WS_URL=wss://.../ws */
export const WS_URL: string = import.meta.env.VITE_WS_URL || "/ws";

export const COLORS = {
  sky: "#a9d8cf", // fondo y niebla
  water: "#3d8f99",
};

/** Reglas del hambre. Espejo de apps/server/internal/pet: si cambias una, cambia las dos. */
export const HUNGER = {
  fullToEmptyHours: 48, // de 100 % a 0 % en 2 días
  feedAmount: 30,
  fullAt: 90, // arriba de esto "¡Está lleno!"
  hungryAt: 25, // abajo de esto: cabizbajo y "tengo hambre"
};
