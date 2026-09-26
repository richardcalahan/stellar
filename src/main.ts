import './ui/styles.css';
import { DragController } from './input/drag';
import { PointerTracker } from './input/pointer';
import { Loop } from './loop';
import { AdaptiveResolution } from './render/adaptive';
import { BodiesView } from './render/bodies';
import { CoronasView } from './render/coronas';
import { DustView } from './render/dust';
import { EffectsView } from './render/effects';
import { Hud } from './render/hud';
import { Labels } from './render/labels';
import type { Lens } from './render/lensing';
import { StarLights } from './render/lights';
import { ParticlesView } from './render/particles';
import { WorldRenderer } from './render/renderer';
import { Rings } from './render/rings';
import { ShipsView } from './render/ships';
import { Sparkles } from './render/sparkles';
import { Starfield } from './render/starfield';
import { Toasts } from './render/toasts';
import { TrailsView } from './render/trails';
import { watchPixelRatio } from './render/viewport';
import { Waves } from './render/waves';
import { AU, G, PALETTE_MASSES, SOLAR } from './sim/constants';
import { stageProgress } from './sim/habitability';
import type { SimEvent } from './sim/types';
import { World } from './sim/world';
import { Attract } from './ui/attract';
import { DebugOverlay } from './ui/debug';
import { installFullscreenButton } from './ui/fullscreen';
import { InfoPanel } from './ui/info';
import { Modifiers } from './ui/modifiers';
import { Palettes } from './ui/palettes';
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

/** The table starts with a Sun and a few worlds so there is something to grab. */
function seedDemoSystem(world: World): void {
  const sun = world.spawn({ mass: PALETTE_MASSES.sun, x: 0, y: 0 });
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

  // A red dwarf with its own small planet, far out and slowly circling the Sun.
  const far = Math.hypot(-720, -360);
  const dwarfSpeed = circular(far);
  const dwarf = world.spawn({
    mass: PALETTE_MASSES.redDwarf,
    x: -720,
    y: -360,
    vx: (360 / far) * dwarfSpeed,
    vy: (-720 / far) * dwarfSpeed,
  });
  const moonSpeed = Math.sqrt((G * dwarf.mass) / 60);
  world.spawn({ mass: 2, x: dwarf.x + 60, y: dwarf.y, vx: dwarf.vx, vy: dwarf.vy + moonSpeed });
}

/**
 * Test scenes, chosen with ?scene=name, that make a slow event happen within
 * a few seconds of loading: merge, nebula, supernova, blackhole, dust, life.
 */
function seedScene(world: World, scene: string): void {
  const circular = (mass: number, r: number): number => Math.sqrt((G * mass) / r);
  switch (scene) {
    case 'merge': {
      world.spawn({ mass: PALETTE_MASSES.sun, x: -180, y: 0, vx: 70, vy: 0 });
      world.spawn({ mass: PALETTE_MASSES.sun, x: 180, y: 0, vx: -70, vy: 0 });
      world.spawn({ mass: 1, x: 0, y: 400, vx: -circular(2 * SOLAR, 400), vy: 0 });
      return;
    }
    case 'nebula': {
      const sun = world.spawn({ mass: PALETTE_MASSES.sun, x: 0, y: 0 });
      sun.age = sun.lifetime - 3;
      world.spawn({ mass: 1, x: AU, y: 0, vx: 0, vy: circular(SOLAR, AU) });
      return;
    }
    case 'supernova': {
      const star = world.spawn({ mass: 12 * SOLAR, x: 0, y: 0 });
      star.age = star.lifetime - 3;
      world.spawn({ mass: 1, x: 200, y: 0, vx: 0, vy: circular(star.mass, 200) });
      world.spawn({ mass: 100, x: -650, y: 0, vx: 0, vy: -circular(star.mass, 650) });
      world.spawn({ mass: PALETTE_MASSES.sun, x: 0, y: 500, vx: -circular(star.mass, 500), vy: 0 });
      return;
    }
    case 'blackhole': {
      const star = world.spawn({ mass: 25 * SOLAR, x: 0, y: 0 });
      star.age = star.lifetime - 2;
      const other = world.spawn({ mass: 10 * SOLAR, x: 700, y: 0 });
      other.age = other.lifetime - 5;
      world.spawn({ mass: 1, x: -400, y: 0, vx: 0, vy: -circular(star.mass, 400) });
      return;
    }
    case 'dust': {
      world.spawn({ mass: PALETTE_MASSES.sun, x: 0, y: 0 });
      world.dust.emit(0, 0, 520, 0.6 * SOLAR, 2500, 8, world.random);
      return;
    }
    case 'life': {
      const sun = world.spawn({ mass: PALETTE_MASSES.sun, x: 0, y: 0 });
      world.setLocked(sun, true);
      const nuclear = world.spawn({ mass: 1, x: AU, y: 0, vx: 0, vy: circular(SOLAR, AU) });
      nuclear.habitableTime = 122;
      const space = world.spawn({
        mass: 1,
        x: 0,
        y: 1.15 * AU,
        vx: -circular(SOLAR, 1.15 * AU),
        vy: 0,
      });
      space.habitableTime = 136;
      world.spawn({ mass: 1, x: -0.5 * AU, y: 0, vx: 0, vy: -circular(SOLAR, 0.5 * AU) });
      return;
    }
    default:
      seedDemoSystem(world);
  }
}

const webglCanvas = element('webgl', HTMLCanvasElement);
const hudCanvas = element('hud', HTMLCanvasElement);
const overlay = element('overlay', HTMLDivElement);

const query = new URLSearchParams(window.location.search);
const world = new World();
seedScene(world, query.get('scene') ?? '');

const renderer = new WorldRenderer(webglCanvas);
const hud = new Hud(hudCanvas);
renderer.addResizable(hud);

const starfield = new Starfield();
renderer.scene.add(starfield.points);
renderer.addResizable(starfield);

const lights = new StarLights();
const bodies = new BodiesView(lights);
const coronas = new CoronasView();
const trails = new TrailsView();
const particles = new ParticlesView();
const effects = new EffectsView();
const dust = new DustView();
const ships = new ShipsView();
const sparkles = new Sparkles(particles, world.random);
renderer.scene.add(
  dust.points,
  trails.points,
  bodies.group,
  ships.group,
  coronas.mesh,
  effects.group,
  particles.points,
);
renderer.addResizable(particles);
renderer.addResizable(dust);
renderer.addResizable(trails);

const labels = new Labels(hud, renderer.camera, stageProgress);
const rings = new Rings(hud, renderer.camera);
const toasts = new Toasts(hud, renderer.camera);
const waves = new Waves(hud, renderer.camera);
const debug = new DebugOverlay(hud, query.has('debug'));

const drag = new DragController(world);
const pointers = new PointerTracker(
  webglCanvas,
  (px, py) => renderer.camera.screenToPlane(px, py),
  drag,
);
pointers.install();

const palettes = new Palettes(overlay, (kind, event) => {
  const pointer = pointers.adopt(event);
  if (!pointer) return null;
  const body = drag.spawnAndHold(pointer, PALETTE_MASSES[kind]);
  if (!body) {
    pointers.pointers.delete(pointer.id);
    return null;
  }
  return () => undefined;
});
drag.onRelease = (pointerId) => {
  palettes.released(pointerId);
};

const modifiers = new Modifiers(overlay, world, renderer.camera, () => drag.mouseHeld());

const resetTable = (): void => {
  world.reset();
  seedDemoSystem(world);
};
const info = new InfoPanel(overlay, resetTable);
const attract = new Attract(resetTable);

installFullscreenButton(overlay);
keepScreenAwake();

const layoutChrome = (): void => {
  palettes.layout(renderer.viewport.width, renderer.viewport.height);
  info.layout(renderer.viewport.width, renderer.viewport.height);
};
const onResize = (): void => {
  renderer.resize();
  layoutChrome();
};
layoutChrome();
window.addEventListener('resize', onResize);
watchPixelRatio(onResize);
const adaptive = new AdaptiveResolution(onResize);

/**
 * One-shot visuals for the things the simulation reports. Speeds and
 * lifetimes are slow on purpose: a star's death should take seconds to
 * unfold, not flash past.
 */
function playEvents(events: readonly SimEvent[], now: number): void {
  const random = world.random;
  for (const event of events) {
    const { x, y } = event;
    switch (event.kind) {
      case 'death':
        if (event.remnant === 'whiteDwarf') {
          particles.ring(x, y, event.starRadius, 1800, 28, NEBULA_INNER, NEBULA_RIM, 10, random);
          particles.burst(x, y, 400, 22, [0.6, 0.3, 0.9], 12, 4, random);
        } else {
          particles.burst(x, y, 500, 260, [1, 1, 1], 1.5, 3.5, random);
          particles.shell(x, y, 1600, 140, [1.0, 0.45, 0.7], 4.5, random);
          particles.ring(
            x,
            y,
            event.starRadius,
            500,
            60,
            [0.7, 0.3, 1.0],
            [0.4, 0.15, 0.8],
            7,
            random,
          );
        }
        break;
      case 'ignite':
        particles.burst(x, y, 220, 110, [1.0, 0.85, 0.5], 2.0, 10, random);
        break;
      case 'collapse':
        particles.burst(x, y, 160, 40, [0.3, 1.0, 1.0], 3, 8, random);
        break;
      case 'merge': {
        // A shockwave in the survivor's colour, big enough to clear its glow, and a crisp HUD ring.
        const survivor = world.find(event.survivorId);
        const color = survivor?.color ?? [1, 1, 1];
        const reach = 60 + (survivor?.radius ?? 7) * 6;
        particles.shell(x, y, 220, reach * 0.9, color, 1.6, random);
        particles.burst(x, y, 120, 120, [1, 1, 1], 1.0, 6, random);
        waves.pulse(x, y, now, color, reach, 1.4);
        break;
      }
      case 'swallow':
        particles.shell(x, y, 140, 80, [0.55, 0.75, 1.0], 1.2, random);
        waves.pulse(x, y, now, [0.6, 0.8, 1.0], 70, 1.0);
        break;
      case 'grb':
        effects.burst(x, y, now);
        waves.push(x, y, now);
        particles.burst(x, y, 300, 380, [1.0, 0.5, 1.0], 1.6, 7, random);
        break;
      case 'war':
        if (event.cause === 'nuclear' || event.cause === 'attack') {
          particles.burst(x, y, 60, 40, [1.0, 0.9, 0.7], 1.0, 6, random);
        }
        break;
      case 'colonize':
        if (event.outcome === 'colonized') {
          const civ = world.civilization(event.civId);
          particles.burst(x, y, 60, 40, civ?.color ?? [1, 1, 1], 1.8, 6, random);
        }
        break;
      case 'stageChange':
      case 'shipLaunch':
        break;
    }
  }
}

const NEBULA_INNER: [number, number, number] = [0.35, 0.6, 1.0];
const NEBULA_RIM: [number, number, number] = [1.0, 0.25, 0.2];

if (query.get('scene') === 'fx') {
  // Fire every one-shot effect at load, for checking the particle system by eye.
  const random = world.random;
  particles.ring(-400, 0, 20, 1800, 28, NEBULA_INNER, NEBULA_RIM, 10, random);
  particles.shell(400, 0, 1600, 140, [1.0, 0.45, 0.7], 4.5, random);
  particles.burst(400, 0, 500, 260, [1, 1, 1], 1.5, 3.5, random);
  particles.shell(0, -350, 220, 90, [1.0, 0.85, 0.5], 1.6, random);
  waves.pulse(0, -350, 0, [1.0, 0.85, 0.5], 100, 1.4);
  waves.push(0, 350, 0);
  effects.burst(0, 350, 0);
}

const pendingEvents: SimEvent[] = [];
const lenses: Lens[] = [];
const lensPoint = { x: 0, y: 0 };
let lastFrame = 0;

const loop = new Loop({
  step: (dt) => {
    for (const event of world.step(dt)) pendingEvents.push(event);
  },
  render: (_alpha, stats) => {
    const now = stats.elapsed;
    const frameDt = Math.min(now - lastFrame, 0.1);
    lastFrame = now;

    drag.prune();
    if (pendingEvents.length > 0) {
      toasts.consume(pendingEvents, now);
      playEvents(pendingEvents, now);
      pendingEvents.length = 0;
    }

    lights.update(world);
    bodies.sync(world, now);
    coronas.sync(world, renderer.camera.three, now);
    trails.update(world, now);
    effects.sync(world, now);
    ships.sync(world, now);
    dust.update(world.dust);
    sparkles.update(world, frameDt);
    particles.update(frameDt);
    starfield.update(now);

    lenses.length = 0;
    for (const body of world.bodies) {
      if (body.remnant !== 'blackHole') continue;
      const p = renderer.camera.project(body.x, body.y, 0, lensPoint);
      lenses.push({ x: p.x, y: p.y, radius: body.radius });
    }
    renderer.lensing.setLenses(lenses, renderer.viewport.width, renderer.viewport.height);
    renderer.render();

    hud.clear();
    labels.draw(world, renderer.viewport);
    rings.draw(world, now);
    waves.draw(now);
    toasts.draw(now);
    debug.draw(stats, renderer.viewport, { bodies: world.bodies.length, dust: world.dust.count });

    modifiers.update();
    palettes.setEnabled(!world.isFull);
    attract.update();
    adaptive.update(stats.frameMs);
  },
});

loop.start();
