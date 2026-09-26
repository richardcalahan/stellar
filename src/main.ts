import './ui/styles.css';
import { Loop } from './loop';
import { BodiesView } from './render/bodies';
import { CoronasView } from './render/coronas';
import { Hud } from './render/hud';
import { Labels } from './render/labels';
import { StarLights } from './render/lights';
import { WorldRenderer } from './render/renderer';
import { Starfield } from './render/starfield';
import { watchPixelRatio } from './render/viewport';
import { AU, G, PALETTE_MASSES } from './sim/constants';
import { World } from './sim/world';
import { DebugOverlay } from './ui/debug';
import { installFullscreenButton } from './ui/fullscreen';
import { keepScreenAwake } from './ui/wakelock';

/**
 * The composition root: the one place that knows about every part and wires
 * them together. Nothing else imports main.
 */

function element<T extends HTMLElement>(id: string, type: new () => T): T {
  const found = document.getElementById(id);
  if (!(found instanceof type)) throw new Error(`Missing #${id} in index.html`);
  return found;
}

/**
 * Until the palettes arrive in Module 4, the table starts with a system
 * placed in code: a Sun, an Earth on a circular orbit at one AU, a gas giant
 * further out, and a small planet on an eccentric orbit close in.
 */
function seedDemoSystem(world: World): void {
  const sun = world.spawn({ mass: PALETTE_MASSES.sun, x: 0, y: 0 });
  // Circular orbit speed v = sqrt(G M / r). Module 4 moves this into orbits.ts.
  const circular = (r: number): number => Math.sqrt((G * sun.mass) / r);

  world.spawn({ mass: PALETTE_MASSES.planet, x: AU, y: 0, vx: 0, vy: circular(AU) });
  world.spawn({
    mass: PALETTE_MASSES.gasGiant,
    x: -1.7 * AU,
    y: 0,
    vx: 0,
    vy: -circular(1.7 * AU),
  });
  world.spawn({ mass: 3, x: 0, y: 0.6 * AU, vx: -0.85 * circular(0.6 * AU), vy: 0 });
}

const webglCanvas = element('webgl', HTMLCanvasElement);
const hudCanvas = element('hud', HTMLCanvasElement);
const overlay = element('overlay', HTMLDivElement);

const world = new World();
seedDemoSystem(world);

const renderer = new WorldRenderer(webglCanvas);
const hud = new Hud(hudCanvas);
renderer.addResizable(hud);

const starfield = new Starfield();
renderer.scene.add(starfield.points);
renderer.addResizable(starfield);

const lights = new StarLights();
const bodies = new BodiesView(lights);
const coronas = new CoronasView();
renderer.scene.add(bodies.group, coronas.mesh);

const labels = new Labels(hud, renderer.camera);
const debug = new DebugOverlay(hud, new URLSearchParams(window.location.search).has('debug'));

installFullscreenButton(overlay);
keepScreenAwake();

window.addEventListener('resize', () => {
  renderer.resize();
});
watchPixelRatio(() => {
  renderer.resize();
});

const loop = new Loop({
  step: (dt) => {
    world.step(dt);
  },
  render: (_alpha, stats) => {
    lights.update(world);
    bodies.sync(world, stats.elapsed);
    coronas.sync(world, renderer.camera.three, stats.elapsed);
    starfield.update(stats.elapsed);
    renderer.render();

    hud.clear();
    labels.draw(world, renderer.viewport);
    debug.draw(stats, renderer.viewport, { bodies: world.bodies.length, dust: 0 });
  },
});

loop.start();
