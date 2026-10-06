import { MathUtils, Vector3 } from "three";
import type { Updatable } from "../core/loop";
import type { Duck } from "../world/duck";
import { waveHeight } from "../world/pond";

/** Interpola entre dos ángulos por el camino más corto. */
function lerpAngle(a: number, b: number, k: number) {
  const diff = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + diff * k;
}

/** "Suavizado exponencial": misma sensación sin importar los FPS. */
const damp = (rate: number, delta: number) => 1 - Math.exp(-rate * delta);

/**
 * Hace nadar a un pato: elige un punto, gira hacia él, avanza y a veces descansa.
 * pickPoint siempre devuelve un punto visible en pantalla.
 */
export class Swimmer implements Updatable {
  heading = Math.random() * Math.PI * 2;
  speed = 0;
  partner?: Swimmer;
  /** Segundos que le quedan nadando junto a su pareja. */
  together = 0;

  private target = new Vector3();
  private rest = 0;

  constructor(
    readonly duck: Duck,
    private pickPoint: (out: Vector3) => Vector3,
    private maxSpeed = 0.5,
  ) {
    pickPoint(duck.position);
    pickPoint(this.target);
  }

  tick(delta: number, t: number) {
    const pos = this.duck.position;
    let desiredSpeed = 0;

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
      const dist = Math.hypot(this.target.x - pos.x, this.target.z - pos.z);
      const desired =
        dist < 0.25
          ? p.heading // ya está al lado: mira hacia donde mira su pareja
          : Math.atan2(this.target.x - pos.x, this.target.z - pos.z);
      this.heading = lerpAngle(this.heading, desired, damp(3, delta));
      desiredSpeed = Math.min(this.maxSpeed * 1.3, p.speed + dist * 1.2);
      if (this.together <= 0) this.pickPoint(this.target);
    } else if (this.rest > 0) {
      this.rest -= delta;
    } else {
      const dx = this.target.x - pos.x;
      const dz = this.target.z - pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.15) {
        this.rest = MathUtils.randFloat(0.5, 3);
        this.pickPoint(this.target);
      } else {
        this.heading = lerpAngle(this.heading, Math.atan2(dx, dz), damp(2.5, delta));
        desiredSpeed = this.maxSpeed * Math.min(1, dist / 0.8); // frena al llegar
      }
    }

    this.speed = MathUtils.lerp(this.speed, desiredSpeed, damp(2, delta));
    // rotation.y = heading hace que +Z apunte a (sin h, cos h).
    pos.x += Math.sin(this.heading) * this.speed * delta;
    pos.z += Math.cos(this.heading) * this.speed * delta;
    pos.y = waveHeight(pos.x, pos.z, t);
    this.duck.rotation.y = this.heading;
    this.duck.moving = this.speed / this.maxSpeed;
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
    // Separación: si están muy cerca, se empujan suavemente.
    const pa = this.a.duck.position;
    const pb = this.b.duck.position;
    const dx = pb.x - pa.x;
    const dz = pb.z - pa.z;
    const d = Math.hypot(dx, dz) || 0.001;
    const min = 0.6;
    if (d < min) {
      const push = ((min - d) / d) * 0.5;
      pa.x -= dx * push;
      pa.z -= dz * push;
      pb.x += dx * push;
      pb.z += dz * push;
    }

    if (this.a.together > 0 || this.b.together > 0) return;
    this.nextTogether -= delta;
    if (this.nextTogether <= 0) {
      // Uno guía y el otro lo alcanza para nadar a su lado.
      const follower = Math.random() < 0.5 ? this.a : this.b;
      follower.together = MathUtils.randFloat(8, 14);
      this.nextTogether = MathUtils.randFloat(18, 30);
    }
  }
}
