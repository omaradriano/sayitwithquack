// Notificaciones push en el navegador.
// En iPhone solo funcionan si la app se abrió desde la pantalla de inicio (iOS 16.4+).

export type PushStatus =
  | "unsupported" // el navegador no tiene Web Push
  | "needs-install" // iPhone en Safari normal: hay que agregarla a la pantalla de inicio
  | "denied" // el usuario bloqueó el permiso
  | "off" // se puede activar
  | "on"; // ya está suscrito

const isIOS = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** Registra sw.js (solo muestra notificaciones; no cachea nada). */
export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("/sw.js");
  } catch (err) {
    console.warn("service worker:", err);
  }
}

export async function pushStatus(): Promise<PushStatus> {
  if (!supported()) return isIOS() && !isStandalone() ? "needs-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  const sub = await currentSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** La llave VAPID viaja en base64url; pushManager.subscribe la quiere en bytes. */
function keyToBytes(base64url: string) {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function sameKey(sub: PushSubscription, key: Uint8Array) {
  const current = sub.options.applicationServerKey;
  if (!current) return false;
  const a = new Uint8Array(current);
  return a.length === key.length && a.every((v, i) => v === key[i]);
}

/**
 * Pide permiso y se suscribe. Debe llamarse desde un toque (iOS lo exige).
 * Devuelve la suscripción para mandarla al servidor.
 */
export async function enablePush(vapidKey: string): Promise<PushSubscriptionJSON> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error(permission);
  const reg = await navigator.serviceWorker.ready;
  const key = keyToBytes(vapidKey);
  let sub = await reg.pushManager.getSubscription();
  // Si el servidor cambió de llaves, la suscripción vieja ya no sirve.
  if (sub && !sameKey(sub, key)) {
    await sub.unsubscribe();
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  return sub.toJSON();
}

/** Si este dispositivo ya estaba suscrito, devuelve la suscripción (para re-registrarla en el servidor). */
export async function existingSubscription(vapidKey: string): Promise<PushSubscriptionJSON | null> {
  if (!supported() || Notification.permission !== "granted") return null;
  const sub = await currentSubscription();
  return sub && sameKey(sub, keyToBytes(vapidKey)) ? sub.toJSON() : null;
}
