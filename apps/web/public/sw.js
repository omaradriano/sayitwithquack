// Service worker: solo recibe y muestra notificaciones push.
// No guarda nada en caché, así que no ocupa espacio en el teléfono.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Llega un push desde el servidor Go: { title, body, tag }
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Say it with Quack", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag, // mismo tag = reemplaza la notificación anterior en vez de apilarse
      data: { url: "/" },
    }),
  );
});

// Al tocar la notificación: abre el estanque (o enfoca la ventana si ya está abierta).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => "focus" in w);
      return open ? open.focus() : self.clients.openWindow(event.notification.data?.url || "/");
    }),
  );
});
