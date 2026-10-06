import type { Object3D } from "three";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";

const SWAP_EVERY = 5000; // ms entre nombre ↔ estado
const FADE = 200; // ms del desvanecido (igual que en style.css)

/** Renderer de HTML encima del canvas: los <div> siguen a objetos 3D. */
export function createLabelRenderer(container: HTMLElement) {
  const r = new CSS2DRenderer();
  r.domElement.className = "labels";
  container.appendChild(r.domElement);
  return r;
}

/** null = no sabemos (estamos sin conexión). */
export type Presence = { online: true } | { online: false; lastSeen?: number } | null;

const time = new Intl.DateTimeFormat("es-MX", { hour: "numeric", minute: "2-digit" });
const day = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" });

/** "hoy 2:32 p.m.", "ayer 9:10 p.m." o "3 oct 9:10 p.m." en la hora de este teléfono. */
export function formatLastSeen(ms: number, now = new Date()): string {
  const d = new Date(ms);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const when =
    ms >= startOfToday ? "hoy" : ms >= startOfToday - 86_400_000 ? "ayer" : day.format(d).replace(".", "");
  return `${when} ${time.format(d)}`;
}

function statusText(p: Exclude<Presence, null>) {
  if (p.online) return "en línea";
  return p.lastSeen ? `visto ${formatLastSeen(p.lastSeen)}` : "desconectado";
}

/**
 * Etiqueta con el nombre del pato. Cuando sabemos su estado, alterna cada 5 s
 * entre el nombre y "en línea" / "visto hoy 2:32 p.m.".
 */
export class DuckLabel {
  readonly el: HTMLDivElement;
  private text: HTMLSpanElement;
  private presence: Presence = null;
  private showingStatus = false;

  constructor(
    target: Object3D,
    private name: string,
    height = 1.1,
  ) {
    this.el = document.createElement("div");
    this.el.className = "duck-label";
    this.text = document.createElement("span");
    this.text.className = "label-text";
    this.text.textContent = name;
    const badge = document.createElement("span");
    badge.className = "manual-badge";
    badge.textContent = "🕹️ en control";
    this.el.append(this.text, badge);

    const label = new CSS2DObject(this.el);
    label.position.set(0, height, 0);
    target.add(label);

    setInterval(() => this.swap(), SWAP_EVERY);
  }

  setPresence(p: Presence) {
    this.presence = p;
    this.el.classList.toggle("is-online", p?.online === true);
    this.el.classList.toggle("is-offline", p?.online === false);
    if (!p) this.showingStatus = false;
    this.render();
  }

  private swap() {
    if (!this.presence) return;
    // Desvanece, cambia el texto y vuelve a aparecer.
    this.text.classList.add("fading");
    setTimeout(() => {
      this.showingStatus = !this.showingStatus;
      this.render();
      this.text.classList.remove("fading");
    }, FADE);
  }

  private render() {
    this.text.textContent =
      this.showingStatus && this.presence ? statusText(this.presence) : this.name;
  }
}
