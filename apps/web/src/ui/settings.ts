import type { DuckColors } from "../world/duck";

export interface SettingsValues extends DuckColors {
  message: string;
}

export const MAX_MESSAGE = 60;

interface SettingsHandlers {
  /** Configuración guardada actualmente. */
  current(): SettingsValues;
  /** Vista previa en vivo mientras eliges colores. */
  preview(colors: DuckColors): void;
  /** Guarda y envía. Devuelve false si no hay conexión. */
  save(values: SettingsValues): boolean;
}

const COLOR_FIELDS: { key: keyof DuckColors; label: string }[] = [
  { key: "body", label: "Cuerpo" },
  { key: "wing", label: "Alas" },
  { key: "head", label: "Cabeza" },
];

/** Botón ☰ y panel lateral para configurar tu pato. */
export class SettingsMenu {
  private panel: HTMLElement;
  private backdrop: HTMLDivElement;
  private colors = {} as Record<keyof DuckColors, HTMLInputElement>;
  private message: HTMLTextAreaElement;
  private counter: HTMLElement;
  private error: HTMLElement;
  private saveButton: HTMLButtonElement;

  constructor(private handlers: SettingsHandlers) {
    // Va en <body> y no dentro de #app: así tocar el menú no activa el joystick.
    const burger = document.createElement("button");
    burger.className = "burger";
    burger.setAttribute("aria-label", "Configuración");
    burger.innerHTML = "<span></span><span></span><span></span>";
    burger.addEventListener("click", () => this.open());

    this.backdrop = document.createElement("div");
    this.backdrop.className = "settings-backdrop";
    this.backdrop.addEventListener("click", () => this.close());

    this.panel = document.createElement("aside");
    this.panel.className = "settings";
    this.panel.innerHTML = `
      <header>
        <h2>Tu pato</h2>
        <button class="settings-close" aria-label="Cerrar">✕</button>
      </header>
      <section>
        <h3>Colores</h3>
        ${COLOR_FIELDS.map(
          (f) => `<label class="color-row"><span>${f.label}</span><input type="color" name="${f.key}" /></label>`,
        ).join("")}
      </section>
      <section>
        <h3>Mensaje</h3>
        <p class="settings-hint">Aparece en tu etiqueta cada pocos segundos</p>
        <textarea rows="3" maxlength="${MAX_MESSAGE}" placeholder="Escribe algo bonito 💛"></textarea>
        <div class="settings-counter"></div>
      </section>
      <div class="settings-footer">
        <p class="settings-error" hidden>Sin conexión. Intenta de nuevo en un momento.</p>
        <button class="settings-save">Guardar configuración</button>
      </div>`;

    for (const f of COLOR_FIELDS) {
      const input = this.panel.querySelector<HTMLInputElement>(`input[name="${f.key}"]`)!;
      input.addEventListener("input", () => this.handlers.preview(this.readColors()));
      this.colors[f.key] = input;
    }
    this.message = this.panel.querySelector("textarea")!;
    this.counter = this.panel.querySelector(".settings-counter")!;
    this.error = this.panel.querySelector(".settings-error")!;
    this.saveButton = this.panel.querySelector(".settings-save")!;

    this.message.addEventListener("input", () => this.updateCounter());
    this.panel.querySelector(".settings-close")!.addEventListener("click", () => this.close());
    this.saveButton.addEventListener("click", () => this.save());

    document.body.append(burger, this.backdrop, this.panel);
  }

  private readColors(): DuckColors {
    return { body: this.colors.body.value, wing: this.colors.wing.value, head: this.colors.head.value };
  }

  private updateCounter() {
    this.counter.textContent = `${this.message.value.length}/${MAX_MESSAGE}`;
  }

  open() {
    // Siempre parte de lo guardado.
    const v = this.handlers.current();
    for (const f of COLOR_FIELDS) this.colors[f.key].value = v[f.key];
    this.message.value = v.message;
    this.updateCounter();
    this.error.hidden = true;
    this.saveButton.disabled = false;
    this.saveButton.textContent = "Guardar configuración";
    document.body.classList.add("settings-open");
  }

  /** Cierra sin guardar: los colores vuelven a como estaban. */
  close() {
    document.body.classList.remove("settings-open");
    this.handlers.preview(this.handlers.current());
  }

  private save() {
    const ok = this.handlers.save({ ...this.readColors(), message: this.message.value.trim() });
    if (!ok) {
      this.error.hidden = false;
      return;
    }
    this.error.hidden = true;
    this.saveButton.disabled = true;
    this.saveButton.textContent = "¡Guardado! ✓";
    setTimeout(() => this.close(), 900);
  }
}
