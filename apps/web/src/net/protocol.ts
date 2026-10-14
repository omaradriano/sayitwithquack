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
  | ({ t: "config" } & DuckConfig)
  | { t: "push-subscribe"; subscription: PushSubscriptionJSON }
  | { t: "quack" }
  | { t: "feed" };

// Servidor → cliente
export type ServerMessage =
  | {
      t: "welcome";
      online: DuckId[];
      /** ms Unix de la última desconexión de cada pato */
      lastSeen: Partial<Record<DuckId, number>>;
      states: Partial<Record<DuckId, DuckState>>;
      configs: Partial<Record<DuckId, DuckConfig>>;
      /** llave pública VAPID para suscribirse a notificaciones */
      vapidKey: string;
      pets: Partial<Record<DuckId, PetState>>;
      /** hora del servidor (ms Unix) */
      now: number;
      /** contador de días compartido (sube cuando los dos alimentaron ese día) */
      days: number;
    }
  | { t: "presence"; online: DuckId[]; lastSeen: Partial<Record<DuckId, number>> }
  | ({ t: "state"; duck: DuckId } & DuckState)
  | ({ t: "config"; duck: DuckId } & DuckConfig)
  | QuackResult
  | ({ t: "pet"; duck: DuckId; fed: boolean; seed: number; now: number; days: number } & PetState)
  | { t: "feed-result"; reason: "full" | "coins" };

/** Hambre: "nivel en el momento at". El hambre actual se calcula con el tiempo transcurrido. */
export interface PetState {
  level: number; // 0–100
  at: number; // ms Unix (hora del servidor)
  coins: number;
  /** fecha local (México) de la última comida, "2026-10-13" */
  lastDay: string;
}

/** Respuesta al botón de quack: a cuántos dispositivos se envió. */
export interface QuackResult {
  t: "quack-result";
  sent: number;
  reason?: "cooldown" | "no-subscription";
}
