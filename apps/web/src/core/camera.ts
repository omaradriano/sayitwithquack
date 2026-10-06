import { MathUtils, PerspectiveCamera } from "three";

// Inclinación de la cámara sobre el agua (vista 3/4).
const TILT = MathUtils.degToRad(48);
// Cuántas unidades del mundo queremos ver de ancho (móvil) o de alto (desktop).
const FIT_WIDTH = 5.4;
const FIT_HEIGHT = 5.5;

export function createCamera(): PerspectiveCamera {
  // (campo de visión vertical en grados, aspecto, plano cercano, plano lejano)
  return new PerspectiveCamera(40, 1, 0.1, 100);
}

/**
 * Coloca la cámara según el aspecto de la pantalla para que el estanque
 * se vea igual de bien en un iPhone SE vertical que en un monitor.
 * Devuelve la distancia al centro del estanque.
 */
export function frameCamera(camera: PerspectiveCamera, aspect: number): number {
  camera.aspect = aspect;
  const vfov = MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
  const dist = Math.max(
    FIT_WIDTH / 2 / Math.tan(hfov / 2),
    FIT_HEIGHT / 2 / Math.tan(vfov / 2),
  );
  camera.position.set(0, Math.sin(TILT) * dist, Math.cos(TILT) * dist);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return dist;
}
