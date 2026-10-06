import { MathUtils, Vector3 } from "three";
import type { Updatable } from "../core/loop";
import type { Duck } from "../world/duck";
import { waveHeight } from "../world/pond";
import { POND } from "../config";
import type { DuckState } from "../net/protocol";

/** Interpola entre dos ángulos por el camino más corto. */
function lerpAngle(a: number, b: number, k: number) {
  const diff = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + diff * k;
}

/** "Suavizado exponencial": misma sensación sin importar los FPS. */
const damp = (rate: number, delta: number) => 1 - Math.exp(-rate * delta);

/** Punto aleatorio dentro del área de nado. */
export function randomPondPoint(out: Vector3, margin = 0.3) {
  return out.set(
    MathUtils.randFloatSpread(2 * (POND.halfWidth - margin)),
    0,
    MathUtils.randFloatSpread(2 * (POND.halfDepth - margin)),
  );
}

function clampToPond(p: Vector3) {
  p.x = MathUtils.clamp(p.x, -POND.halfWidth, POND.halfWidth);
  p.z = MathUtils.clamp(p.z, -POND.halfDepth, POND.halfDepth);
}

/**
 * auto   → nada solo
 * manual → lo mueve el joystick de este teléfono
 * remote → lo mueve el teléfono de la otra persona (llega por websocket)
 */
export type SwimMode = "auto" | "manual" | "remote";

const MANUAL_HOLD = 1.5; // segundos quieto tras soltar antes de volver a nadar solo

export class Swimmer implements Updatable {
  mode: SwimMode = "auto";
  heading = Math.random() * Math.PI * 2;
  speed = 0;
  partner?: Swimmer;
  /** Segundos que le quedan nadando junto a su pareja. */
  together = 0;
  /** Dirección del joystick (x derecha, y abajo) en modo manual. */
  readonly input = { x: 0, y: 0 };

  private target = new Vector3();
  private rest = 0;
  private holding = false;
  private hold = 0;
  private remote: DuckState | null = null;
  /** Segundos desde el último mensaje recibido. */
  private remoteAge = 0;

  constructor(
    readonly duck: Duck,
    private maxSpeed = 0.5,
  ) {
    randomPondPoint(duck.position);
    randomPondPoint(this.target);
  }

  /** ¿Lo está moviendo una persona (aquí o en el otro teléfono)? */
  get manual() {
    return this.mode === "manual" || (this.mode === "remote" && !!this.remote?.m);
  }

  // ---- Control manual ----
  startManual() {
    this.mode = "manual";
    this.holding = true;
    this.together = 0;
  }

  endManual() {
    this.holding = false;
    this.hold = MANUAL_HOLD;
  }

  // ---- Control remoto ----
  /** Llegó una posición nueva por la red. */
  applyRemote(s: DuckState) {
    if (this.mode !== "remote") {
      // Primera vez: aparecemos directo ahí, sin animar desde lejos.
      this.duck.position.set(s.x, 0, s.z);
      this.heading = s.h;
    }
    this.mode = "remote";
    this.remote = { ...s };
    this.remoteAge = 0;
  }

  /** Continúa desde un estado guardado (por ejemplo, al recargar la página). */
  restore(s: DuckState) {
    this.duck.position.set(s.x, 0, s.z);
    this.heading = s.h;
  }

  /** La otra persona se fue: el pato vuelve a nadar solo desde donde quedó. */
  releaseRemote() {
    this.mode = "auto";
    this.remote = null;
    randomPondPoint(this.target);
  }

  /** Estado para mandar por la red. */
  snapshot(): DuckState {
    const p = this.duck.position;
    const r = (n: number) => Math.round(n * 1000) / 1000; // menos bytes
    return { x: r(p.x), z: r(p.z), h: r(this.heading), s: r(this.speed), m: this.manual };
  }

  tick(delta: number, t: number) {
    if (this.mode === "remote") this.tickRemote(delta);
    else {
      const desiredSpeed = this.mode === "manual" ? this.tickManual(delta) : this.tickAuto(delta);
      this.speed = MathUtils.lerp(this.speed, desiredSpeed, damp(this.mode === "manual" ? 5 : 2, delta));
      // rotation.y = heading hace que +Z apunte a (sin h, cos h).
      this.duck.position.x += Math.sin(this.heading) * this.speed * delta;
      this.duck.position.z += Math.cos(this.heading) * this.speed * delta;
      clampToPond(this.duck.position);
    }

    const pos = this.duck.position;
    pos.y = waveHeight(pos.x, pos.z, t);
    this.duck.rotation.y = this.heading;
    this.duck.moving = Math.min(1, Math.abs(this.speed) / this.maxSpeed);
    this.duck.manual = this.manual;
  }

  /** Devuelve la velocidad deseada. */
  private tickManual(delta: number): number {
    if (!this.holding) {
      this.hold -= delta;
      if (this.hold <= 0) {
        this.mode = "auto";
        this.rest = MathUtils.randFloat(0.5, 1.5);
        randomPondPoint(this.target);
      }
      return 0;
    }
    const { x, y } = this.input;
    const mag = Math.min(1, Math.hypot(x, y));
    if (mag === 0) return 0;
    // La cámara no gira, así que derecha en pantalla = +X y abajo en pantalla = +Z.
    this.heading = lerpAngle(this.heading, Math.atan2(x, y), damp(8, delta));
    return this.maxSpeed * 1.8 * mag;
  }

  private tickAuto(delta: number): number {
    const pos = this.duck.position;

    if (this.together > 0 && this.partner) {
      this.together -= delta;
      // Objetivo: a un costado de la pareja.
      const p = this.partner;
      const right = 0.7;
      this.target.set(
        p.duck.position.x + Math.cos(p.heading) * right,
        0,
        p.duck.position.z - Math.sin(p.heading) * right,
      );
      clampToPond(this.target);
      const dist = Math.hypot(this.target.x - pos.x, this.target.z - pos.z);
      const desired =
        dist < 0.25
          ? p.heading // ya está al lado: mira hacia donde mira su pareja
          : Math.atan2(this.target.x - pos.x, this.target.z - pos.z);
      this.heading = lerpAngle(this.heading, desired, damp(3, delta));
      if (this.together <= 0) randomPondPoint(this.target);
      return Math.min(this.maxSpeed * 1.3, p.speed + dist * 1.2);
    }

    if (this.rest > 0) {
      this.rest -= delta;
      return 0;
    }

    const dx = this.target.x - pos.x;
    const dz = this.target.z - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.15) {
      this.rest = MathUtils.randFloat(0.5, 3);
      randomPondPoint(this.target);
      return 0;
    }
    this.heading = lerpAngle(this.heading, Math.atan2(dx, dz), damp(2.5, delta));
    return this.maxSpeed * Math.min(1, dist / 0.8); // frena al llegar
  }

  private tickRemote(delta: number) {
    const s = this.remote;
    if (!s) return;
    // Si dejan de llegar mensajes (pantalla bloqueada, mala señal), frenamos.
    this.remoteAge += delta;
    if (this.remoteAge > 0.4) s.s = 0;
    if (this.remoteAge > 3) s.m = false;
    // Entre mensajes, seguimos avanzando con la última velocidad y rumbo (extrapolación)...
    s.x += Math.sin(s.h) * s.s * delta;
    s.z += Math.cos(s.h) * s.s * delta;
    s.x = MathUtils.clamp(s.x, -POND.halfWidth, POND.halfWidth);
    s.z = MathUtils.clamp(s.z, -POND.halfDepth, POND.halfDepth);
    // ...y nos acercamos suavemente a esa posición estimada.
    const k = damp(8, delta);
    const pos = this.duck.position;
    pos.x = MathUtils.lerp(pos.x, s.x, k);
    pos.z = MathUtils.lerp(pos.z, s.z, k);
    this.heading = lerpAngle(this.heading, s.h, k);
    this.speed = s.s;
  }
}

/** Coordina a la pareja: evita que se encimen y de vez en cuando nadan juntos 💛 */
export class Couple implements Updatable {
  private nextTogether = MathUtils.randFloat(6, 12);

  constructor(
    private a: Swimmer,
    private b: Swimmer,
  ) {
    a.partner = b;
    b.partner = a;
  }

  tick(delta: number) {
    // Separación: si están muy cerca, se empujan. Solo movemos patos que simula este teléfono.
    const pa = this.a.duck.position;
    const pb = this.b.duck.position;
    const dx = pb.x - pa.x;
    const dz = pb.z - pa.z;
    const d = Math.hypot(dx, dz) || 0.001;
    const min = 0.6;
    if (d < min) {
      const aLocal = this.a.mode !== "remote";
      const bLocal = this.b.mode !== "remote";
      const share = aLocal && bLocal ? 0.5 : 1;
      const push = (min - d) / d;
      if (aLocal) {
        pa.x -= dx * push * share;
        pa.z -= dz * push * share;
      }
      if (bLocal) {
        pb.x += dx * push * share;
        pb.z += dz * push * share;
      }
    }

    if (this.a.together > 0 || this.b.together > 0) return;
    this.nextTogether -= delta;
    if (this.nextTogether <= 0) {
      this.nextTogether = MathUtils.randFloat(18, 30);
      // Uno nada hacia el otro, pero solo si nada solo en este teléfono.
      const candidates = [this.a, this.b].filter((s) => s.mode === "auto");
      const follower = candidates[Math.floor(Math.random() * candidates.length)];
      if (follower) follower.together = MathUtils.randFloat(8, 14);
    }
  }
}
