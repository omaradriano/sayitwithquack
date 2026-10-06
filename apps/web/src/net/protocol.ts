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

/** Personalización de un pato. */
export interface DuckConfig {
  body: string; // "#rrggbb"
  wing: string;
  head: string;
  /** mensaje personalizado (máx. 60 caracteres, puede ir vacío) */
  message: string;
}

// Cliente → servidor
export type ClientMessage =
  | { t: "hello"; duck: DuckId }
  | ({ t: "state" } & DuckState)
  | ({ t: "config" } & DuckConfig);

// Servidor → cliente
export type ServerMessage =
  | {
      t: "welcome";
      online: DuckId[];
      /** ms Unix de la última desconexión de cada pato */
      lastSeen: Partial<Record<DuckId, number>>;
      states: Partial<Record<DuckId, DuckState>>;
      configs: Partial<Record<DuckId, DuckConfig>>;
    }
  | { t: "presence"; online: DuckId[]; lastSeen: Partial<Record<DuckId, number>> }
  | ({ t: "state"; duck: DuckId } & DuckState)
  | ({ t: "config"; duck: DuckId } & DuckConfig);
