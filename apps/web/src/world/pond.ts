import { Mesh, MeshStandardMaterial, PlaneGeometry } from "three";
import type { Updatable } from "../core/loop";
import { COLORS } from "../config";

const SIZE = 50;
const SEGMENTS = 40;

/** Altura del agua en (x, z) en el tiempo t. La usan el agua, los patos y los nenúfares. */
export function waveHeight(x: number, z: number, t: number): number {
  return (
    Math.sin(x * 0.9 + t * 1.1) * 0.08 +
    Math.sin(z * 1.3 - t * 0.8) * 0.07 +
    Math.sin((x + z) * 0.5 + t * 0.6) * 0.05
  );
}

export class Pond extends Mesh<PlaneGeometry, MeshStandardMaterial> implements Updatable {
  private base: Float32Array;

  constructor() {
    const geometry = new PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
    // Movemos un poco cada vértice para que los triángulos no se vean como cuadrícula.
    const pos = geometry.attributes.position;
    const cell = SIZE / SEGMENTS;
    for (let i = 0; i < pos.count; i++) {
      pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * cell * 0.6);
      pos.setY(i, pos.getY(i) + (Math.random() - 0.5) * cell * 0.6);
    }

    super(
      geometry,
      new MeshStandardMaterial({
        color: COLORS.water,
        flatShading: true, // cada triángulo con un solo tono = look low poly
        roughness: 0.3,
        metalness: 0.15,
      }),
    );
    this.rotation.x = -Math.PI / 2; // el plano nace vertical (XY); lo acostamos
    this.receiveShadow = true;
    this.base = (pos.array as Float32Array).slice();
  }

  tick(_delta: number, t: number) {
    const pos = this.geometry.attributes.position;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < pos.count; i++) {
      const x = this.base[i * 3];
      const y = this.base[i * 3 + 1];
      // Tras rotar el plano: X local = X mundo, Y local = -Z mundo, Z local = altura.
      arr[i * 3 + 2] = waveHeight(x, -y, t);
    }
    pos.needsUpdate = true; // avisa a la GPU que los vértices cambiaron
  }
}
