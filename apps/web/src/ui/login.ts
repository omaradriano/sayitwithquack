import { DUCKS, type DuckId } from "../config";
import { duckForCode, saveSession } from "../session";

/** Muestra la pantalla del código secreto y resuelve con el pato elegido. */
export function askForDuck(container: HTMLElement): Promise<DuckId> {
  const overlay = document.createElement("div");
  overlay.className = "login";
  overlay.innerHTML = `
    <form class="login-card" autocomplete="off">
      <div class="login-duck">🦆</div>
      <h1>Say it with Quack</h1>
      <p>Escribe tu código secreto para saber qué pato eres</p>
      <input name="code" type="password" placeholder="Código secreto" autocapitalize="off" autocorrect="off" spellcheck="false" />
      <button type="submit">Entrar al estanque</button>
      <p class="login-error" hidden>Ese código no es de ningún pato</p>
    </form>`;
  container.appendChild(overlay);

  const form = overlay.querySelector("form")!;
  const input = overlay.querySelector("input")!;
  const error = overlay.querySelector<HTMLElement>(".login-error")!;

  return new Promise((resolve) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const duck = duckForCode(input.value);
      if (!duck) {
        error.hidden = false;
        form.classList.remove("shake");
        void form.offsetWidth; // reinicia la animación
        form.classList.add("shake");
        return;
      }
      saveSession(duck, input.value);
      const name = DUCKS.find((d) => d.id === duck)!.name;
      form.innerHTML = `<div class="login-duck">🦆</div><h1>¡Hola, ${name}!</h1>`;
      setTimeout(() => {
        overlay.classList.add("hide");
        setTimeout(() => overlay.remove(), 400);
        resolve(duck);
      }, 900);
    });
  });
}
