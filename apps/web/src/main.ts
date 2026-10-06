import { Color, Fog, Scene } from "three";
import { createRenderer } from "./core/renderer";
import { createCamera, frameCamera } from "./core/camera";
import { Loop } from "./core/loop";
import { addLights } from "./world/lights";
import { Pond } from "./world/pond";
import { Duck } from "./world/duck";
import { Decor } from "./world/decor";
import { Swimmer, Couple } from "./behaviors/swim";
import { DuckLabel, createLabelRenderer } from "./ui/labels";
import { askForDuck } from "./ui/login";
import { Joystick } from "./ui/joystick";
import { PresenceBadge } from "./ui/presence";
import { SettingsMenu } from "./ui/settings";
import { Connection } from "./net/connection";
import type { DuckConfig } from "./net/protocol";
import { clearSession, loadSession } from "./session";
import { COLORS, DUCKS, WS_URL, type DuckId } from "./config";

const container = document.getElementById("app")!;
const SEND_INTERVAL = 0.1; // segundos entre envíos de posición (10 por segundo)

function start() {
  const scene = new Scene();
  scene.background = new Color(COLORS.sky);
  scene.fog = new Fog(COLORS.sky, 10, 25);

  const camera = createCamera();
  const renderer = createRenderer(container);
  const labels = createLabelRenderer(container);
  addLights(scene);

  const pond = new Pond();
  const decor = new Decor();
  scene.add(pond, decor);

  const swimmers = new Map<DuckId, Swimmer>();
  const duckLabels = new Map<DuckId, DuckLabel>();
  for (const opts of DUCKS) {
    const duck = new Duck(opts);
    const label = new DuckLabel(duck, opts.name);
    duck.label = label.el;
    duckLabels.set(opts.id, label);
    scene.add(duck);
    swimmers.set(opts.id, new Swimmer(duck));
  }
  const [a, b] = [...swimmers.values()];

  function resize() {
    const { clientWidth: w, clientHeight: h } = container;
    const dist = frameCamera(camera, w / h);
    const fog = scene.fog as Fog;
    fog.near = dist * 1.1;
    fog.far = dist * 2.8;
    renderer.setSize(w, h);
    labels.setSize(w, h);
    decor.layout(camera);
  }
  window.addEventListener("resize", resize);
  resize();

  const loop = new Loop(renderer, () => {
    renderer.render(scene, camera);
    labels.render(scene, camera);
  });
  loop.add(pond);
  loop.add(decor);
  for (const s of swimmers.values()) loop.add(s);
  loop.add(new Couple(a, b));
  for (const s of swimmers.values()) loop.add(s.duck);
  loop.start();

  // Solo en desarrollo: inspecciona la escena desde la consola (window.scene).
  if (import.meta.env.DEV) Object.assign(window, { scene, camera, swimmers });

  // Mientras no sepamos quién eres, los dos patos nadan solos detrás del login.
  const saved = loadSession();
  (saved ? Promise.resolve(saved) : askForDuck(container)).then((me) => {
    enterAs(me, swimmers, duckLabels, loop);
  });
}

/** Ya sabemos qué pato eres: joystick + conexión en vivo. */
function enterAs(
  me: DuckId,
  swimmers: Map<DuckId, Swimmer>,
  duckLabels: Map<DuckId, DuckLabel>,
  loop: Loop,
) {
  const mine = swimmers.get(me)!;
  const partnerId = DUCKS.find((d) => d.id !== me)!.id;
  const partner = swimmers.get(partnerId)!;
  const partnerName = DUCKS.find((d) => d.id === partnerId)!.name;
  const presence = new PresenceBadge(container);

  // Joystick: mueve solo a tu pato.
  const joystick = new Joystick(container, {
    onStart: () => mine.startManual(),
    onEnd: () => mine.endManual(),
  });

  // Configuración (colores + mensaje) de cada pato; arranca con los colores de config.ts.
  const configs = new Map<DuckId, DuckConfig>(
    DUCKS.map((d) => [d.id, { body: d.body, wing: d.wing, head: d.head, message: "" }]),
  );
  function applyConfig(id: DuckId, cfg: DuckConfig) {
    configs.set(id, cfg);
    swimmers.get(id)!.duck.setColors(cfg);
    duckLabels.get(id)!.setMessage(cfg.message);
  }

  // Menú ☰: configura solo tu pato.
  new SettingsMenu({
    current: () => configs.get(me)!,
    preview: (colors) => mine.duck.setColors(colors),
    save(values) {
      if (!conn.send({ t: "config", ...values })) return false;
      applyConfig(me, values);
      return true;
    },
  });

  /** Pone "en línea" / "visto ..." en la etiqueta de cada pato. */
  function updateLabels(online: DuckId[], lastSeen: Partial<Record<DuckId, number>>) {
    for (const [id, label] of duckLabels) {
      label.setPresence(online.includes(id) ? { online: true } : { online: false, lastSeen: lastSeen[id] });
    }
  }

  const conn = new Connection(WS_URL, me, {
    onStatus(status) {
      // Sin conexión no sabemos el estado real: las etiquetas muestran solo el nombre.
      if (status !== "online") for (const label of duckLabels.values()) label.setPresence(null);
      if (status === "connecting") presence.show("Conectando…", false);
      if (status === "offline") {
        // Sin conexión, el pato de tu pareja vuelve a nadar solo en tu pantalla.
        if (partner.mode === "remote") partner.releaseRemote();
        presence.show(conn.replaced ? "Abriste el estanque en otro lado" : "Sin conexión, reintentando…", false);
      }
    },
    onMessage(msg) {
      switch (msg.t) {
        case "welcome":
        case "presence": {
          updateLabels(msg.online, msg.lastSeen ?? {});
          const here = msg.online.includes(partnerId);
          presence.show(here ? `${partnerName} está en el estanque 💛` : `${partnerName} no está en el estanque`, here);
          if (!here && partner.mode === "remote") partner.releaseRemote();
          if (msg.t === "welcome") {
            for (const [id, cfg] of Object.entries(msg.configs ?? {})) {
              if (cfg && configs.has(id as DuckId)) applyConfig(id as DuckId, cfg);
            }
            const own = msg.states[me];
            if (own) mine.restore(own);
            const theirs = msg.states[partnerId];
            if (here && theirs) partner.applyRemote(theirs);
          }
          break;
        }
        case "state":
          if (msg.duck === partnerId) partner.applyRemote(msg);
          break;
        case "config":
          if (configs.has(msg.duck)) applyConfig(msg.duck, msg);
          break;
      }
    },
  });
  conn.connect();

  // Cada frame: pasa el joystick al pato y cada 100 ms manda su posición.
  let sinceSend = 0;
  loop.add({
    tick(delta) {
      mine.input.x = joystick.vector.x;
      mine.input.y = joystick.vector.y;
      sinceSend += delta;
      if (sinceSend >= SEND_INTERVAL) {
        sinceSend = 0;
        conn.send({ t: "state", ...mine.snapshot() });
      }
    },
  });
}

// Abre la app con #salir para olvidar el pato guardado.
if (location.hash === "#salir") {
  clearSession();
  history.replaceState(null, "", location.pathname);
}

try {
  start();
} catch (err) {
  console.error(err);
  container.innerHTML =
    '<div class="fallback">Tu navegador no pudo iniciar WebGL 🦆<br/>Prueba con Safari o Chrome actualizados.</div>';
}
