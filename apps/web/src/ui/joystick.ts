const RADIUS = 48; // px que puede alejarse la perilla del centro
const DEAD_ZONE = 0.15;

interface JoystickHandlers {
  onStart(): void;
  onEnd(): void;
}

/**
 * Joystick flotante: aparece donde tocas y sigue tu dedo.
 * vector: x a la derecha, y hacia abajo, cada uno en [-1, 1].
 */
export class Joystick {
  readonly vector = { x: 0, y: 0 };
  private base: HTMLDivElement;
  private knob: HTMLDivElement;
  private pointerId: number | null = null;
  private origin = { x: 0, y: 0 };

  constructor(
    private surface: HTMLElement,
    private handlers: JoystickHandlers,
  ) {
    this.base = document.createElement("div");
    this.base.className = "joystick";
    this.base.hidden = true;
    this.knob = document.createElement("div");
    this.knob.className = "joystick-knob";
    this.base.appendChild(this.knob);
    surface.appendChild(this.base);

    surface.addEventListener("pointerdown", this.down);
    surface.addEventListener("pointermove", this.move);
    surface.addEventListener("pointerup", this.up);
    surface.addEventListener("pointercancel", this.up);
  }

  private down = (e: PointerEvent) => {
    if (this.pointerId !== null) return; // solo un dedo
    this.pointerId = e.pointerId;
    this.surface.setPointerCapture(e.pointerId);
    this.origin = { x: e.clientX, y: e.clientY };
    this.base.style.left = `${e.clientX}px`;
    this.base.style.top = `${e.clientY}px`;
    this.base.hidden = false;
    this.setKnob(0, 0);
    this.handlers.onStart();
  };

  private move = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    let dx = e.clientX - this.origin.x;
    let dy = e.clientY - this.origin.y;
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS;
      dy = (dy / len) * RADIUS;
    }
    this.setKnob(dx, dy);
  };

  private up = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.base.hidden = true;
    this.vector.x = this.vector.y = 0;
    this.handlers.onEnd();
  };

  private setKnob(dx: number, dy: number) {
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const mag = Math.hypot(dx, dy) / RADIUS;
    const k = mag < DEAD_ZONE ? 0 : 1 / RADIUS;
    this.vector.x = dx * k;
    this.vector.y = dy * k;
  }
}
