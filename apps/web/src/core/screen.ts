import { Camera, Plane, Raycaster, Vector2, Vector3 } from "three";

const raycaster = new Raycaster();
const waterPlane = new Plane(new Vector3(0, 1, 0), 0); // el plano y = 0
const ndc = new Vector2();

/**
 * Convierte un punto de la pantalla en un punto sobre el agua.
 * x, y en "NDC": -1 = izquierda/abajo, 1 = derecha/arriba.
 */
export function screenToWater(camera: Camera, x: number, y: number, out = new Vector3()): Vector3 {
  raycaster.setFromCamera(ndc.set(x, y), camera);
  return raycaster.ray.intersectPlane(waterPlane, out) ?? out.set(0, 0, 0);
}
