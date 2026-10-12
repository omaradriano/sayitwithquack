import type { Object3D } from "three";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { HUNGER } from "../config";

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

type Phase = "name" | "status" | "mood" | "message";
const PHASES: Phase[] = ["name", "status", "mood", "message"];

/**
 * Etiqueta con el nombre del pato. Cada 5 s pasa a la siguiente fase:
 * nombre → "en línea" / "visto hoy 2:32 p.m." → "tengo hambre 🥺" → mensaje personalizado.
 * Debajo lleva la barra de hambre.
 * Las fases sin contenido (sin conexión, sin mensaje) se saltan.
 */
export class DuckLabel {
  readonly el: HTMLDivElement;
  private text: HTMLSpanElement;
  private presence: Presence = null;
  private message = "";
  private hunger = 100;
  private phase: Phase = "name";
  private fill: HTMLDivElement;

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
    const bar = document.createElement("div");
    bar.className = "hunger-bar";
    this.fill = document.createElement("div");
    this.fill.className = "hunger-fill";
    bar.appendChild(this.fill);
    this.el.append(this.text, badge, bar);

    const label = new CSS2DObject(this.el);
    label.position.set(0, height, 0);
    target.add(label);

    setInterval(() => this.next(), SWAP_EVERY);
  }

  setPresence(p: Presence) {
    this.presence = p;
    this.el.classList.toggle("is-online", p?.online === true);
    this.el.classList.toggle("is-offline", p?.online === false);
    this.render();
  }

  setMessage(message: string) {
    this.message = message.trim();
    this.render();
  }

  /** Barra de hambre: verde lleno → amarillo → rojo vacío. */
  setHunger(pct: number) {
    const changedMood = (pct < HUNGER.hungryAt) !== (this.hunger < HUNGER.hungryAt) || (pct <= 0) !== (this.hunger <= 0);
    this.hunger = pct;
    this.fill.style.width = `${pct}%`;
    this.fill.style.background = `hsl(${Math.round(pct * 1.2)} 70% 45%)`;
    this.el.classList.toggle("is-asleep", pct <= 0);
    if (changedMood) this.render();
  }

  private available(phase: Phase) {
    if (phase === "status") return this.presence !== null;
    if (phase === "mood") return this.hunger < HUNGER.hungryAt;
    if (phase === "message") return this.message !== "";
    return true;
  }

  private next() {
    const i = PHASES.indexOf(this.phase);
    // Busca la siguiente fase con contenido (vuelve a "name" si no hay otra).
    let next: Phase = "name";
    for (let k = 1; k <= PHASES.length; k++) {
      const candidate = PHASES[(i + k) % PHASES.length];
      if (this.available(candidate)) {
        next = candidate;
        break;
      }
    }
    if (next === this.phase) return;
    // Desvanece, cambia el texto y vuelve a aparecer.
    this.text.classList.add("fading");
    setTimeout(() => {
      this.phase = next;
      this.render();
      this.text.classList.remove("fading");
    }, FADE);
  }

  private render() {
    if (!this.available(this.phase)) this.phase = "name";
    this.el.classList.toggle("is-message", this.phase === "message");
    if (this.phase === "status" && this.presence) this.text.textContent = statusText(this.presence);
    else if (this.phase === "mood") this.text.textContent = this.hunger <= 0 ? "durmiendo 💤" : "tengo hambre 🥺";
    else if (this.phase === "message") this.text.textContent = `💬 ${this.message}`;
    else this.text.textContent = this.name;
  }
}
