import { SECRET_CODES, type DuckId } from "./config";

const KEY = "sayitwithquack:session";

interface Session {
  duck: DuckId;
  code: string;
}

/** Busca qué pato corresponde a un código. */
export function duckForCode(input: string): DuckId | null {
  const code = input.trim().toLowerCase();
  const entry = Object.entries(SECRET_CODES).find(([, c]) => c.toLowerCase() === code);
  return entry ? (entry[0] as DuckId) : null;
}

/** Devuelve el pato guardado, si el código guardado sigue siendo válido. */
export function loadSession(): DuckId | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    // Si cambiaste el código en config.ts, la sesión vieja deja de valer.
    return duckForCode(s.code) === s.duck ? s.duck : null;
  } catch {
    return null;
  }
}

export function saveSession(duck: DuckId, code: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ duck, code: code.trim() } satisfies Session));
  } catch {
    // Safari privado puede bloquear localStorage: la app sigue funcionando sin recordar.
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
