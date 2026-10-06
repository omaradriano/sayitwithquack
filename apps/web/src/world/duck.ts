import {
  BoxGeometry,
  ConeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  type BufferGeometry,
} from "three";
import type { Updatable } from "../core/loop";

export interface DuckColors {
  body: string;
  wing: string;
  head: string;
}

export interface DuckOptions extends DuckColors {
  name: string;
}

// Las geometrías se comparten entre patos: menos memoria y menos trabajo para la GPU.
// Los materiales de pico y ojos también; los de cuerpo, alas y cabeza son de cada pato
// para poder cambiarles el color.
const geo = {
  body: new BoxGeometry(0.5, 0.3, 0.72),
  tail: new ConeGeometry(0.16, 0.3, 4),
  wing: new BoxGeometry(0.06, 0.18, 0.44),
  neck: new BoxGeometry(0.18, 0.16, 0.18),
  head: new BoxGeometry(0.28, 0.28, 0.3),
  beak: new BoxGeometry(0.16, 0.06, 0.18),
  eye: new BoxGeometry(0.04, 0.06, 0.04),
  ripple: new RingGeometry(0.42, 0.47, 20),
};
const mat = (color: string) => new MeshStandardMaterial({ color, flatShading: true, roughness: 0.8 });
const beak = mat("#f39c34");
const eye = mat("#1b1b1b");

function part(g: BufferGeometry, material: MeshStandardMaterial, x: number, y: number, z: number) {
  const m = new Mesh(g, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/**
 * Un pato low poly hecho de cajas. Mira hacia +Z.
 * Duck (posición y rumbo, lo controla el nado)
 *  └─ model (balanceo sobre el agua)
 *      └─ cuerpo, cabeza, pico...
 */
export class Duck extends Group implements Updatable {
  readonly model = new Group();
  /** 0 = quieto, 1 = nadando a máxima velocidad. Lo actualiza el nado. */
  moving = 0;
  /** true mientras alguien lo mueve con el joystick. Lo actualiza el nado. */
  manual = false;
  /** Etiqueta HTML con el nombre (la crea ui/labels). */
  label?: HTMLElement;
  private phase = Math.random() * Math.PI * 2;
  private ripple: Mesh<RingGeometry, MeshBasicMaterial>;
  private colors: Record<keyof DuckColors, MeshStandardMaterial>;

  constructor(opts: DuckOptions) {
    super();
    this.name = opts.name;
    this.colors = { body: mat(opts.body), wing: mat(opts.wing), head: mat(opts.head) };
    const { body, wing, head } = this.colors;

    const tail = part(geo.tail, body, 0, 0.24, -0.4);
    tail.rotation.set(-1.1, Math.PI / 4, 0);

    this.model.add(
      part(geo.body, body, 0, 0.1, 0),
      tail,
      part(geo.wing, wing, 0.27, 0.15, -0.04),
      part(geo.wing, wing, -0.27, 0.15, -0.04),
      part(geo.neck, head, 0, 0.28, 0.22),
      part(geo.head, head, 0, 0.45, 0.24),
      part(geo.beak, beak, 0, 0.42, 0.46),
      part(geo.eye, eye, 0.142, 0.5, 0.31),
      part(geo.eye, eye, -0.142, 0.5, 0.31),
    );
    this.model.scale.setScalar(1.2);
    this.add(this.model);

    // Onda en el agua alrededor del pato.
    this.ripple = new Mesh(
      geo.ripple,
      new MeshBasicMaterial({ color: "#e8fbff", transparent: true, depthWrite: false }),
    );
    this.ripple.rotation.x = -Math.PI / 2;
    this.ripple.position.y = 0.02;
    this.add(this.ripple);
  }

  /** Cambia los colores al instante: basta con actualizar los materiales. */
  setColors(c: DuckColors) {
    this.colors.body.color.set(c.body);
    this.colors.wing.color.set(c.wing);
    this.colors.head.color.set(c.head);
  }

  /** Colores actuales en formato "#rrggbb". */
  getColors(): DuckColors {
    return {
      body: `#${this.colors.body.color.getHexString()}`,
      wing: `#${this.colors.wing.color.getHexString()}`,
      head: `#${this.colors.head.color.getHexString()}`,
    };
  }

  tick(_delta: number, t: number) {
    const p = this.phase;
    // Balanceo suave, un poco más fuerte cuando nada.
    this.model.rotation.z = Math.sin(t * 1.7 + p) * (0.04 + this.moving * 0.03);
    this.model.rotation.x = Math.sin(t * 2.3 + p) * 0.03 - this.moving * 0.05;

    // La onda crece y se desvanece en ciclo.
    const k = (t * 0.7 + p) % 1;
    this.ripple.scale.setScalar(1 + k * 1.1);
    this.ripple.material.opacity = (1 - k) * (0.15 + this.moving * 0.35);

    // Indicador de "lo están moviendo a mano".
    this.label?.classList.toggle("is-manual", this.manual);
  }
}
