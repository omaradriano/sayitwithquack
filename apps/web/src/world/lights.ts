import { DirectionalLight, HemisphereLight, Scene } from "three";

export function addLights(scene: Scene) {
  // Luz ambiente: color del cielo arriba, reflejo del agua abajo.
  scene.add(new HemisphereLight("#ffe9c7", "#2f6f73", 1.4));

  // "Sol" cálido de atardecer; es el único que proyecta sombras.
  const sun = new DirectionalLight("#ffd9a0", 2.2);
  sun.position.set(-4, 8, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const s = sun.shadow.camera;
  s.left = s.bottom = -10;
  s.right = s.top = 10;
  s.near = 1;
  s.far = 30;
  scene.add(sun);
}
