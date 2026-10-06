/** Pastilla arriba de la pantalla: "Mayra está en el estanque". */
export class PresenceBadge {
  private el: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.el = document.createElement("div");
    this.el.className = "presence";
    this.el.hidden = true;
    container.appendChild(this.el);
  }

  show(text: string, online: boolean) {
    this.el.hidden = false;
    this.el.textContent = text;
    this.el.classList.toggle("online", online);
  }
}
