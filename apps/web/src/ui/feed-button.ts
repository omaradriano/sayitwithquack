import { HUNGER } from "../config";

interface FeedHandlers {
  /** Hambre actual de tu pato (0–100). */
  hunger(): number;
  /** Pide alimentar. Devuelve false si no hay conexión. */
  feed(): boolean;
}

const BUSY_MS = 4500; // lo que dura la animación de comer

/** Botón "🍞 Alimentar" abajo de la pantalla, con un globo para avisos. */
export class FeedButton {
  private button: HTMLButtonElement;
  private toast: HTMLDivElement;
  private toastTimer = 0;
  private busy = false;

  constructor(private handlers: FeedHandlers) {
    const wrap = document.createElement("div");
    wrap.className = "feed";
    this.toast = document.createElement("div");
    this.toast.className = "feed-toast";
    this.toast.hidden = true;
    this.button = document.createElement("button");
    this.button.className = "feed-button";
    this.button.addEventListener("click", () => this.press());
    wrap.append(this.toast, this.button);
    // En <body> y no en #app: así tocarlo no activa el joystick.
    document.body.appendChild(wrap);
    this.refresh();
    setInterval(() => this.refresh(), 1000);
  }

  /** Actualiza el porcentaje (también se llama cuando llega el hambre del servidor). */
  refresh() {
    const pct = Math.round(this.handlers.hunger());
    this.button.textContent = this.busy ? "Comiendo… 😋" : `🍞 Alimentar · ${pct}%`;
    this.button.classList.toggle("is-hungry", pct < HUNGER.hungryAt);
  }

  private press() {
    if (this.busy) return;
    if (this.handlers.hunger() > HUNGER.fullAt) {
      this.say("¡Está lleno! 😋");
      return;
    }
    if (!this.handlers.feed()) {
      this.say("Sin conexión, intenta en un momento");
      return;
    }
    this.busy = true;
    this.button.disabled = true;
    this.refresh();
    setTimeout(() => {
      this.busy = false;
      this.button.disabled = false;
      this.refresh();
    }, BUSY_MS);
  }

  /** El servidor rechazó la comida. */
  rejected(reason: "full" | "coins") {
    this.busy = false;
    this.button.disabled = false;
    this.refresh();
    this.say(reason === "full" ? "¡Está lleno! 😋" : "No tienes monedas suficientes 🪙");
  }

  private say(text: string) {
    this.toast.textContent = text;
    this.toast.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toast.hidden = true), 2200);
  }
}
