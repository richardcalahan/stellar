import {
  AU,
  CLIMATE_CHANCE,
  CLIMATE_WINDOW_SECONDS,
  COLONIZE_SECONDS,
  HABITABLE_DRAIN,
  HABITABLE_INNER_AU,
  HABITABLE_OUTER_AU,
  NUCLEAR_AGE_SECONDS,
  NUCLEAR_WAR_CHANCE,
  STAGE_THRESHOLDS,
  WAR_FLASH_SECONDS,
} from './constants';
import { shines, STAGE_NAMES } from './stars';
import type { Body, LifeStage, PlanetStatus, SimEvent } from './types';
import type { World } from './world';

type LiveStage = Exclude<LifeStage, 'none'>;

const STAGES: readonly LiveStage[] = [
  'simple',
  'complex',
  'intelligent',
  'earlyCiv',
  'farming',
  'industrial',
  'nuclear',
  'spaceAge',
];

/** Position of a stage in the climb: -1 for none, 0 for simple life, 7 for the Space Age. */
export function stageIndex(stage: LifeStage): number {
  return (STAGES as readonly LifeStage[]).indexOf(stage);
}

/** Inner and outer edge of a star's habitable zone in world units. */
export function habitableZone(luminosity: number): { inner: number; outer: number } {
  const scale = Math.sqrt(Math.max(luminosity, 0));
  return { inner: HABITABLE_INNER_AU * AU * scale, outer: HABITABLE_OUTER_AU * AU * scale };
}

/** The star whose light matters most to a planet: luminosity over distance squared. */
export function dominantStar(body: Body, world: World): Body | null {
  let best: Body | null = null;
  let bestScore = 0;
  for (const other of world.bodies) {
    if (other === body || !shines(other)) continue;
    const dx = other.x - body.x;
    const dy = other.y - body.y;
    const score = other.luminosity / (dx * dx + dy * dy + 1);
    if (score > bestScore) {
      best = other;
      bestScore = score;
    }
  }
  return best;
}

/** The highest stage whose threshold the planet's habitable time has passed. */
export function stageFor(habitableTime: number): LifeStage {
  let stage: LifeStage = 'none';
  for (const candidate of STAGES) {
    if (habitableTime >= STAGE_THRESHOLDS[candidate]) stage = candidate;
  }
  return stage;
}

/** Progress from the current stage toward the next, 0 to 1, for the label. */
export function stageProgress(body: Body): number {
  if (body.status === 'colonizing') return Math.min(body.statusAge / COLONIZE_SECONDS, 1);
  if (body.status !== 'habitable') return 0;
  const index = stageIndex(body.lifeStage);
  const next = STAGES[index + 1];
  if (next === undefined) return 1;
  const current = STAGES[index];
  const from = current === undefined ? 0 : STAGE_THRESHOLDS[current];
  const to = STAGE_THRESHOLDS[next];
  return Math.min(Math.max((body.habitableTime - from) / (to - from), 0), 1);
}

/**
 * Per-second probability that gives a total chance over a window:
 * (1 - p)^window = 1 - chance.
 */
export function hazardPerSecond(chance: number, windowSeconds: number): number {
  return 1 - (1 - chance) ** (1 / windowSeconds);
}

/**
 * Planets in the zone accumulate habitable time and climb the life stages.
 * Too close is lava, too far is ice. The Nuclear Age is a coin toss, and
 * climate change takes a few industrial worlds. A red giant sterilizes.
 */
export function stepHabitability(world: World, dt: number, events: SimEvent[]): void {
  const nuclearHazard = hazardPerSecond(NUCLEAR_WAR_CHANCE, NUCLEAR_AGE_SECONDS);
  const climateHazard = hazardPerSecond(CLIMATE_CHANCE, CLIMATE_WINDOW_SECONDS);

  for (const body of world.bodies) {
    if (body.remnant !== null || body.starClass !== 'planet') continue;
    body.statusAge += dt;

    if (body.status === 'deadWorld') continue;
    if (body.status === 'nuclearWar') {
      if (body.statusAge >= WAR_FLASH_SECONDS) setStatus(body, 'deadWorld');
      continue;
    }
    if (body.status === 'colonizing') {
      if (body.statusAge >= COLONIZE_SECONDS) {
        setStatus(body, 'colonized');
        if (body.civId !== null) {
          events.push({
            kind: 'colonize',
            x: body.x,
            y: body.y,
            bodyId: body.id,
            civId: body.civId,
            outcome: 'colonized',
          });
        }
      }
      continue;
    }

    const star = dominantStar(body, world);
    let zone: PlanetStatus = 'frigidIce';
    if (star) {
      const distance = Math.hypot(star.x - body.x, star.y - body.y);
      const { inner, outer } = habitableZone(star.luminosity);
      zone = distance < inner ? 'lavaHot' : distance > outer ? 'frigidIce' : 'habitable';
      if (star.phase === 'redGiant' && body.lifeStage !== 'none') {
        body.lifeStage = 'none';
        body.habitableTime = 0;
        setStatus(body, 'deadWorld');
        events.push({ kind: 'war', x: body.x, y: body.y, bodyId: body.id, cause: 'sterilized' });
        continue;
      }
    }

    if (body.status === 'colonized') {
      // A colony keeps its people whatever the climate, until something kills it.
    } else if (zone !== body.status) {
      setStatus(body, zone);
    }

    if (zone === 'habitable') {
      body.habitableTime += dt;
    } else {
      body.habitableTime = Math.max(0, body.habitableTime - dt * HABITABLE_DRAIN);
    }

    const stage = stageFor(body.habitableTime);
    if (stage !== body.lifeStage) {
      const climbed = stageIndex(stage) > stageIndex(body.lifeStage);
      body.lifeStage = stage;
      if (climbed && stage !== 'none') {
        events.push({
          kind: 'stageChange',
          x: body.x,
          y: body.y,
          bodyId: body.id,
          stage,
          status: body.status,
          label: STAGE_NAMES[stage],
        });
      }
    }

    if (zone !== 'habitable' && body.status !== 'colonized') continue;
    if (body.lifeStage === 'nuclear' && world.random() < hazardPerSecond(nuclearHazard, 1 / dt)) {
      setStatus(body, 'nuclearWar');
      events.push({ kind: 'war', x: body.x, y: body.y, bodyId: body.id, cause: 'nuclear' });
      continue;
    }
    if (
      (body.lifeStage === 'industrial' || body.lifeStage === 'nuclear') &&
      world.random() < hazardPerSecond(climateHazard, 1 / dt)
    ) {
      setStatus(body, 'deadWorld');
      events.push({ kind: 'war', x: body.x, y: body.y, bodyId: body.id, cause: 'climate' });
    }
  }
}

/** Status shows on the label, not as a toast; the events that cause it (war, colonize) toast themselves. */
function setStatus(body: Body, status: PlanetStatus): void {
  if (body.status === status) return;
  body.status = status;
  body.statusAge = 0;
  if (status === 'deadWorld') {
    body.lifeStage = 'none';
    body.habitableTime = 0;
    body.civId = null;
  }
}
