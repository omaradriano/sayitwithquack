import { Color, Fog, Scene, Vector3, MathUtils } from "three";
import { createRenderer } from "./core/renderer";
import { createCamera, frameCamera } from "./core/camera";
import { screenToWater } from "./core/screen";
import { Loop } from "./core/loop";
import { addLights } from "./world/lights";
import { Pond } from "./world/pond";
import { Duck } from "./world/duck";
import { Decor } from "./world/decor";
import { Swimmer, Couple } from "./behaviors/swim";
import { addLabel, createLabelRenderer } from "./ui/labels";
import { COLORS, DUCKS } from "./config";

const container = document.getElementById("app")!;

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

  // Punto aleatorio del agua que siempre se ve en pantalla (con margen para la etiqueta).
  const pickPoint = (out: Vector3) =>
    screenToWater(camera, MathUtils.randFloat(-0.7, 0.7), MathUtils.randFloat(-0.7, 0.5), out);

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

  // Los patos se crean con la cámara ya encuadrada, para que nazcan dentro de la pantalla.
  const [a, b] = DUCKS.map((opts) => {
    const duck = new Duck(opts);
    addLabel(duck, opts.name);
    scene.add(duck);
    return new Swimmer(duck, pickPoint);
  });


  const loop = new Loop(renderer, () => {
    renderer.render(scene, camera);
    labels.render(scene, camera);
  });
  loop.add(pond);
  loop.add(decor);
  loop.add(a);
  loop.add(b);
  loop.add(new Couple(a, b));
  loop.add(a.duck);
  loop.add(b.duck);
  loop.start();

  // Solo en desarrollo: inspecciona la escena desde la consola (window.scene).
  if (import.meta.env.DEV) Object.assign(window, { scene, camera, swimmers: [a, b] });
}

try {
  start();
} catch (err) {
  console.error(err);
  container.innerHTML =
    '<div class="fallback">Tu navegador no pudo iniciar WebGL 🦆<br/>Prueba con Safari o Chrome actualizados.</div>';
}
