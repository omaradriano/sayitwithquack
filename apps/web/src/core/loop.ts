import type { WebGLRenderer } from "three";

/** Cualquier cosa que se anime implementa tick(delta, elapsed). */
export interface Updatable {
  tick(delta: number, elapsed: number): void;
}

export class Loop {
  private updatables: Updatable[] = [];
  private last = 0;
  private elapsed = 0;

  constructor(
    private renderer: WebGLRenderer,
    private render: () => void,
  ) {
    // Pausa cuando la pestaña no está visible (ahorra batería).
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.stop();
      else this.start();
    });
  }

  add(u: Updatable) {
    this.updatables.push(u);
  }

  start() {
    this.last = performance.now();
    // setAnimationLoop llama a la función en cada frame (~60 veces por segundo).
    this.renderer.setAnimationLoop((now: number) => {
      // delta = segundos desde el frame anterior, entre 0 y 0.1 (el primer frame
      // puede llegar con un timestamp anterior a performance.now() → delta negativo).
      const delta = Math.min(Math.max((now - this.last) / 1000, 0), 0.1);
      this.last = now;
      this.elapsed += delta;
      for (const u of this.updatables) u.tick(delta, this.elapsed);
      this.render();
    });
  }

  stop() {
    this.renderer.setAnimationLoop(null);
  }
}
