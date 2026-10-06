import type { DuckId } from "../config";
import type { ClientMessage, ServerMessage } from "./protocol";

export type Status = "connecting" | "online" | "offline";

interface Handlers {
  onMessage(msg: ServerMessage): void;
  onStatus(status: Status): void;
}

/** "/ws" → "ws://host/ws" (o wss:// en https). Las URLs completas se respetan. */
function resolveUrl(url: string) {
  const u = new URL(url, location.href);
  if (u.protocol === "http:") u.protocol = "ws:";
  if (u.protocol === "https:") u.protocol = "wss:";
  return u.toString();
}

/** WebSocket que se presenta como un pato y se reconecta solo si se cae. */
export class Connection {
  private ws?: WebSocket;
  private retry = 0;
  private closedByServer = false;

  constructor(
    private url: string,
    private duck: DuckId,
    private handlers: Handlers,
  ) {}

  connect() {
    this.handlers.onStatus("connecting");
    const ws = new WebSocket(resolveUrl(this.url));
    this.ws = ws;

    ws.onopen = () => {
      this.retry = 0;
      this.send({ t: "hello", duck: this.duck });
      this.handlers.onStatus("online");
    };
    ws.onmessage = (e) => {
      try {
        this.handlers.onMessage(JSON.parse(e.data) as ServerMessage);
      } catch (err) {
        console.warn("mensaje inválido", err);
      }
    };
    ws.onclose = (e) => {
      this.handlers.onStatus("offline");
      // "replaced" = abriste la app en otro lado; esa conexión gana y aquí no reintentamos.
      if (e.reason === "replaced") {
        this.closedByServer = true;
        return;
      }
      // Reintento con espera exponencial: 1s, 2s, 4s... máximo 15s.
      const wait = Math.min(1000 * 2 ** this.retry++, 15000);
      setTimeout(() => this.connect(), wait);
    };
  }

  get replaced() {
    return this.closedByServer;
  }

  send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }
}
