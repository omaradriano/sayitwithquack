import {
  BoxGeometry,
  Camera,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Object3D,
} from "three";
import type { Updatable } from "../core/loop";
import { screenToWater } from "../core/screen";
import { waveHeight } from "./pond";

const m = (color: string) => new MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 });
const mats = {
  pad: m("#5f9e4f"),
  padDark: m("#4b8640"),
  petal: m("#f29bb5"),
  pistil: m("#ffd84d"),
  reed: m("#5c9a52"),
  cattail: m("#6b4a2f"),
  rock: m("#8d99a6"),
};
const geo = {
  pad: new CylinderGeometry(0.26, 0.26, 0.03, 7),
  petal: new ConeGeometry(0.09, 0.13, 5),
  pistil: new BoxGeometry(0.04, 0.04, 0.04),
  reed: new ConeGeometry(0.06, 1, 4),
  cattail: new BoxGeometry(0.06, 0.18, 0.06),
  rock: new DodecahedronGeometry(0.35, 0),
};

function mesh(g: (typeof geo)[keyof typeof geo], mat: MeshStandardMaterial) {
  const x = new Mesh(g, mat);
  x.castShadow = true;
  x.receiveShadow = true;
  return x;
}

function lilyCluster(count: number, flower: boolean) {
  const g = new Group();
  for (let i = 0; i < count; i++) {
    const pad = mesh(geo.pad, i % 2 ? mats.padDark : mats.pad);
    pad.scale.setScalar(MathUtils.randFloat(0.7, 1.15));
    pad.position.set(MathUtils.randFloatSpread(0.7), 0.02, MathUtils.randFloatSpread(0.7));
    pad.rotation.y = Math.random() * Math.PI;
    g.add(pad);
  }
  if (flower) {
    const f = new Group();
    f.add(mesh(geo.petal, mats.petal));
    const p = mesh(geo.pistil, mats.pistil);
    p.position.y = 0.07;
    f.add(p);
    f.position.set(0, 0.09, 0);
    g.add(f);
  }
  return g;
}

function reedClump(count: number, reeds: Mesh[]) {
  const g = new Group();
  for (let i = 0; i < count; i++) {
    const r = mesh(geo.reed, mats.reed);
    const h = MathUtils.randFloat(0.6, 1.3);
    r.scale.y = h;
    // El cono está centrado en su origen: lo subimos media altura para que nazca del agua.
    r.position.set(MathUtils.randFloatSpread(0.5), h / 2, MathUtils.randFloatSpread(0.5));
    r.rotation.z = MathUtils.randFloatSpread(0.25);
    r.userData = { lean: r.rotation.z, phase: Math.random() * 6 };
    g.add(r);
    reeds.push(r);
    if (Math.random() < 0.4) {
      const c = mesh(geo.cattail, mats.cattail);
      c.position.set(r.position.x, h * 0.85, r.position.z);
      g.add(c);
    }
  }
  return g;
}

function rock(scale: number) {
  const r = mesh(geo.rock, mats.rock);
  r.scale.set(scale, scale * 0.55, scale);
  r.rotation.y = Math.random() * Math.PI;
  r.position.y = 0.05;
  return r;
}

interface Placed {
  obj: Object3D;
  /** Posición en pantalla (NDC) donde vive este adorno. */
  at: [number, number];
  floats: boolean;
}

/**
 * Nenúfares, juncos y rocas. Se colocan en posiciones *de pantalla*,
 * así siempre enmarcan el estanque sin importar el tamaño del teléfono.
 */
export class Decor extends Group implements Updatable {
  private placed: Placed[] = [];
  private reeds: Mesh[] = [];

  constructor() {
    super();
    const place = (obj: Object3D, at: [number, number], floats = false) => {
      this.placed.push({ obj, at, floats });
      this.add(obj);
    };

    // Juncos y rocas en los bordes, medio fuera de cuadro.
    place(reedClump(9, this.reeds), [-1.0, -0.9]);
    place(rock(1.2), [-0.75, -1.0]);
    place(reedClump(7, this.reeds), [1.0, 0.15]);
    place(rock(0.8), [0.92, 0.0]);
    place(reedClump(6, this.reeds), [-0.98, 0.55]);
    place(reedClump(8, this.reeds), [0.9, 0.95]);
    place(rock(1.0), [-0.6, 1.0]);

    // Nenúfares flotando.
    place(lilyCluster(3, true), [-0.55, 0.3], true);
    place(lilyCluster(2, false), [0.55, 0.6], true);
    place(lilyCluster(3, true), [0.6, -0.6], true);
    place(lilyCluster(1, false), [-0.2, -0.75], true);
    place(lilyCluster(2, true), [0.05, 0.85], true);
  }

  /** Recalcula posiciones al cambiar el tamaño de pantalla. */
  layout(camera: Camera) {
    for (const p of this.placed) {
      const y = p.obj.position.y;
      screenToWater(camera, p.at[0], p.at[1], p.obj.position);
      p.obj.position.y = y;
    }
  }

  tick(_delta: number, t: number) {
    for (const r of this.reeds) {
      r.rotation.z = r.userData.lean + Math.sin(t * 1.3 + r.userData.phase) * 0.04;
    }
    for (const p of this.placed) {
      if (p.floats) p.obj.position.y = waveHeight(p.obj.position.x, p.obj.position.z, t);
    }
  }
}
