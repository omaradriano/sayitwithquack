// Mensajes del websocket. Espejo de apps/server/internal/protocol: si cambias uno, cambia el otro.
import type { DuckId } from "../config";

export interface DuckState {
  x: number;
  z: number;
  /** rumbo en radianes */
  h: number;
  /** velocidad */
  s: number;
  /** true = lo están moviendo a mano */
  m: boolean;
}

// Cliente → servidor
export type ClientMessage = { t: "hello"; duck: DuckId } | ({ t: "state" } & DuckState);

// Servidor → cliente
export type ServerMessage =
  | { t: "welcome"; online: DuckId[]; states: Partial<Record<DuckId, DuckState>> }
  | { t: "presence"; online: DuckId[] }
  | ({ t: "state"; duck: DuckId } & DuckState);
