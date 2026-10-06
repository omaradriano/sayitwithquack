import type { Object3D } from "three";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";

/** Renderer de HTML encima del canvas: los <div> siguen a objetos 3D. */
export function createLabelRenderer(container: HTMLElement) {
  const r = new CSS2DRenderer();
  r.domElement.className = "labels";
  container.appendChild(r.domElement);
  return r;
}

export function addLabel(target: Object3D, text: string, height = 1.1) {
  const el = document.createElement("div");
  el.className = "duck-label";
  el.textContent = text;
  const label = new CSS2DObject(el);
  label.position.set(0, height, 0);
  target.add(label);
  return label;
}
