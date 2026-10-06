import { MathUtils, PerspectiveCamera, Vector3 } from "three";
import { POND } from "../config";

// Inclinación de la cámara sobre el agua (vista 3/4).
const TILT = MathUtils.degToRad(48);
// Hasta dónde de la pantalla pueden llegar las esquinas del área de nado (NDC).
const MARGIN_X = 0.86;
const MARGIN_BOTTOM = -0.88;
const MARGIN_TOP = 0.78; // más espacio arriba para la etiqueta del pato

export function createCamera(): PerspectiveCamera {
  // (campo de visión vertical en grados, aspecto, plano cercano, plano lejano)
  return new PerspectiveCamera(40, 1, 0.1, 100);
}

function place(camera: PerspectiveCamera, dist: number) {
  camera.position.set(0, Math.sin(TILT) * dist, Math.cos(TILT) * dist);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
}

const corner = new Vector3();
function pondFits(camera: PerspectiveCamera) {
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      // project() convierte un punto del mundo a coordenadas de pantalla (NDC).
      corner.set(sx * POND.halfWidth, 0, sz * POND.halfDepth).project(camera);
      if (Math.abs(corner.x) > MARGIN_X || corner.y > MARGIN_TOP || corner.y < MARGIN_BOTTOM) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Acerca la cámara lo más posible sin que el área de nado se salga de la pantalla.
 * Así el estanque se ve igual de bien en un iPhone SE vertical que en un monitor.
 * Devuelve la distancia al centro del estanque.
 */
export function frameCamera(camera: PerspectiveCamera, aspect: number): number {
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  // Búsqueda binaria de la distancia.
  let near = 1;
  let far = 60;
  for (let i = 0; i < 24; i++) {
    const mid = (near + far) / 2;
    place(camera, mid);
    if (pondFits(camera)) far = mid;
    else near = mid;
  }
  place(camera, far);
  return far;
}
