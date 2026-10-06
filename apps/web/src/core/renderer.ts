import { WebGLRenderer, PCFShadowMap } from "three";

export function createRenderer(container: HTMLElement): WebGLRenderer {
  const renderer = new WebGLRenderer({ antialias: true });
  // Pantallas retina pueden tener 3x: lo limitamos a 2 para cuidar el rendimiento.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  container.appendChild(renderer.domElement);
  return renderer;
}
