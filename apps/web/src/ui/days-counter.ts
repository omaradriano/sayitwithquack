import { DUCKS, type DuckId } from "../config";

/** Texto oscuro sobre colores claros y blanco sobre oscuros. */
function textOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 150 ? "#3a2a00" : "#fff";
}

/**
 * Contador de días compartido, arriba a la izquierda: una "gema" low poly con el número.
 * Abajo, un circulito por pato que se llena cuando su dueño ya lo alimentó hoy.
 */
export class DaysCounter {
  private el: HTMLDivElement;
  private number: HTMLSpanElement;
  private unit: HTMLSpanElement;
  private dots = new Map<DuckId, HTMLSpanElement>();
  private shown: number | null = null;

  constructor(private fedToday: (duck: DuckId) => boolean) {
    this.el = document.createElement("div");
    this.el.className = "days";
    this.el.hidden = true; // hasta que el servidor mande el número real
    this.el.innerHTML = `
      <div class="days-gem">
        <span class="days-number"></span>
        <span class="days-unit"></span>
      </div>
      <div class="days-dots"></div>`;
    this.number = this.el.querySelector(".days-number")!;
    this.unit = this.el.querySelector(".days-unit")!;
    const dots = this.el.querySelector(".days-dots")!;
    for (const duck of DUCKS) {
      const dot = document.createElement("span");
      dot.className = "days-dot";
      dot.textContent = duck.name[0];
      dot.style.setProperty("--duck", duck.body);
      dot.style.setProperty("--duck-text", textOn(duck.body));
      dots.appendChild(dot);
      this.dots.set(duck.id, dot);
    }
    // En <body> y no en #app, como los demás controles fijos.
    document.body.appendChild(this.el);
    // A medianoche los circulitos se vacían aunque nadie mande nada.
    setInterval(() => this.refresh(), 30_000);
  }

  set(days: number) {
    this.el.hidden = false;
    this.number.textContent = String(days);
    this.unit.textContent = days === 1 ? "día" : "días";
    // Si subió (no al cargar), un pequeño salto para celebrarlo.
    if (this.shown !== null && days > this.shown) {
      this.el.classList.remove("bump");
      void this.el.offsetWidth; // reinicia la animación
      this.el.classList.add("bump");
    }
    this.shown = days;
    this.refresh();
  }

  /** Actualiza quién ya alimentó hoy. */
  refresh() {
    for (const [id, dot] of this.dots) dot.classList.toggle("is-fed", this.fedToday(id));
  }
}
