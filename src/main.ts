import './ui/styles.css';
import { Loop } from './loop';
import { Hud } from './render/hud';
import { WorldRenderer } from './render/renderer';
import { Starfield } from './render/starfield';
import { PlaceholderSun } from './render/sun';
import { watchPixelRatio } from './render/viewport';
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

const webglCanvas = element('webgl', HTMLCanvasElement);
const hudCanvas = element('hud', HTMLCanvasElement);
const overlay = element('overlay', HTMLDivElement);

const renderer = new WorldRenderer(webglCanvas);
const hud = new Hud(hudCanvas);
renderer.addResizable(hud);

const starfield = new Starfield();
renderer.scene.add(starfield.points);
renderer.addResizable(starfield);

const sun = new PlaceholderSun();
renderer.scene.add(sun.group);

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
  step: () => {
    // Module 2 adds world.step(dt) here.
  },
  render: (_alpha, stats) => {
    starfield.update(stats.elapsed);
    sun.update(stats.elapsed, renderer.camera.three);
    renderer.render();

    hud.clear();
    debug.draw(stats, renderer.viewport, { bodies: 1, dust: 0 });
  },
});

loop.start();
