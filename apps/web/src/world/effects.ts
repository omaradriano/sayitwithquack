import {
  DodecahedronGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  Vector3,
} from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import type { Updatable } from "../core/loop";
import type { Swimmer } from "../behaviors/swim";
import type { Duck } from "./duck";
import { waveHeight } from "./pond";

const CRUMBS = 5;
const GRAVITY = 4.5; // más suave que la real: se ve mejor en cámara lenta
const PECK_EVERY = 0.5; // segundos entre picotazos
const ZZZ_EVERY = 2.5;

const crumbGeo = new DodecahedronGeometry(0.075, 0);
const crumbMats = ["#f2c46d", "#ffd98a", "#e0a84f"].map(
  (color) => new MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 }),
);
const splashGeo = new RingGeometry(0.06, 0.09, 14);

/** Números "aleatorios" repetibles a partir de una semilla (mulberry32). */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Un efecto vive hasta que update devuelve false. */
interface Effect {
  update(delta: number, t: number): boolean;
}

/** Animaciones sueltas: alimentar (migajas, splash, corazones) y 💤 de patos dormidos. */
export class Effects extends Group implements Updatable {
  private effects: Effect[] = [];
  private zzzTimers = new Map<Duck, number>();

  constructor(private ducks: Duck[]) {
    super();
  }

  tick(delta: number, t: number) {
    this.effects = this.effects.filter((e) => e.update(delta, t));

    // 💤 sobre los patos dormidos.
    for (const duck of this.ducks) {
      if (!duck.asleep) continue;
      const left = (this.zzzTimers.get(duck) ?? 0) - delta;
      if (left <= 0) {
        this.floatEmoji(duck.position.clone().add(new Vector3(0.15, 0.95, 0)), "💤", "zzz");
        this.zzzTimers.set(duck, ZZZ_EVERY);
      } else this.zzzTimers.set(duck, left);
    }
  }

  /** Un emoji que sube y se desvanece (HTML encima del canvas). */
  floatEmoji(at: Vector3, emoji: string, kind = "") {
    const outer = document.createElement("div");
    const inner = document.createElement("span");
    inner.className = `floater ${kind}`;
    inner.textContent = emoji;
    outer.appendChild(inner);
    // CSS2DRenderer controla el transform del div de afuera; la animación va en el de adentro.
    const obj = new CSS2DObject(outer);
    obj.position.copy(at);
    this.add(obj);
    let life = 1.4;
    this.effects.push({
      update: (delta) => {
        life -= delta;
        if (life > 0) return true;
        this.remove(obj); // también quita el div
        return false;
      },
    });
  }

  private splash(at: Vector3) {
    const ring = new Mesh(
      splashGeo,
      new MeshBasicMaterial({ color: "#e8fbff", transparent: true, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(at).setY(at.y + 0.02);
    this.add(ring);
    let k = 0;
    this.effects.push({
      update: (delta) => {
        k += delta / 0.6;
        ring.scale.setScalar(1 + k * 3);
        ring.material.opacity = 0.8 * (1 - k);
        if (k < 1) return true;
        this.remove(ring);
        ring.material.dispose();
        return false;
      },
    });
  }

  /**
   * Animación de alimentar: caen migajas frente al pato y se las come una por una.
   * Con la misma seed, las migajas caen igual en los dos teléfonos.
   */
  feed(swimmer: Swimmer, seed: number) {
    const duck = swimmer.duck;
    const rand = seeded(seed);
    const h = swimmer.heading;
    const forward = new Vector3(Math.sin(h), 0, Math.cos(h));
    const right = new Vector3(Math.cos(h), 0, -Math.sin(h));

    const crumbs = Array.from({ length: CRUMBS }, (_, i) => {
      const mesh = new Mesh(crumbGeo, crumbMats[i % crumbMats.length]);
      mesh.castShadow = true;
      const spot = duck.position
        .clone()
        .addScaledVector(forward, 0.62 + rand() * 0.12)
        .addScaledVector(right, (i - (CRUMBS - 1) / 2) * 0.14 + (rand() - 0.5) * 0.05);
      mesh.position.set(spot.x, 1.6 + i * 0.22 + rand() * 0.2, spot.z); // caen escalonadas
      mesh.rotation.set(rand() * 3, rand() * 3, 0);
      this.add(mesh);
      return { mesh, vy: 0, landed: false, eaten: false };
    });

    const fallTime = 1.4;
    const total = fallTime + CRUMBS * PECK_EVERY + 0.3;
    // El dueño del pato lo deja quieto mientras come (el otro teléfono lo ve por la red).
    if (swimmer.mode !== "remote") swimmer.eating = total;

    let time = 0;
    let nextPeck = fallTime;
    let eatenCount = 0;
    this.effects.push({
      update: (delta, t) => {
        time += delta;
        for (const c of crumbs) {
          if (c.eaten) continue;
          const water = waveHeight(c.mesh.position.x, c.mesh.position.z, t) + 0.02;
          if (!c.landed) {
            c.vy -= GRAVITY * delta;
            c.mesh.position.y += c.vy * delta;
            c.mesh.rotation.x += delta * 4;
            if (c.mesh.position.y <= water) {
              c.landed = true;
              this.splash(c.mesh.position);
            }
          } else {
            c.mesh.position.y = water; // flota con las olas
          }
        }

        // Picotazos: agacha la cabeza y a la mitad del picotazo desaparece una migaja.
        if (time >= nextPeck && eatenCount < CRUMBS) {
          duck.peck();
          const target = crumbs[eatenCount];
          eatenCount++;
          nextPeck += PECK_EVERY;
          setTimeout(() => {
            target.eaten = true;
            this.remove(target.mesh);
            this.floatEmoji(target.mesh.position.clone().setY(0.5), "💛", "heart");
          }, 200);
        }

        if (time < total) return true;
        for (const c of crumbs) this.remove(c.mesh);
        return false;
      },
    });
  }
}
