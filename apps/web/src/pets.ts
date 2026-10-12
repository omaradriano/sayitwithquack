import { HUNGER, type DuckId } from "./config";
import type { PetState } from "./net/protocol";

const DECAY_PER_MS = 100 / (HUNGER.fullToEmptyHours * 3600 * 1000);

/**
 * Hambre de los patos. El servidor manda "nivel X en el momento T" y su hora actual;
 * aquí calculamos el hambre de cualquier instante sin depender del reloj del teléfono.
 */
export class Pets {
  private states = new Map<DuckId, PetState>();
  /** hora del servidor - hora del teléfono */
  private offset = 0;

  syncClock(serverNow: number) {
    this.offset = serverNow - Date.now();
  }

  set(duck: DuckId, s: PetState) {
    this.states.set(duck, { level: s.level, at: s.at, coins: s.coins });
  }

  known(duck: DuckId) {
    return this.states.has(duck);
  }

  /** Hambre actual 0–100 (100 si todavía no sabemos). */
  hunger(duck: DuckId): number {
    const s = this.states.get(duck);
    if (!s) return 100;
    const now = Date.now() + this.offset;
    return Math.max(0, Math.min(100, s.level - (now - s.at) * DECAY_PER_MS));
  }
}
