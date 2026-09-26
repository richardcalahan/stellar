export type StarClass =
  | 'planet'
  | 'gasGiant'
  | 'brownDwarf'
  | 'redDwarf'
  | 'yellow'
  | 'white'
  | 'blue'
  | 'blueGiant'
  | 'superGiant'
  | 'megaGiant';

/** What a star leaves behind, or a star that has not ignited yet. Overrides the class. */
export type Remnant = 'protostar' | 'whiteDwarf' | 'pulsar' | 'magnetar' | 'blackHole';

export type StarPhase = 'main' | 'redGiant';

export type LifeStage =
  | 'none'
  | 'simple'
  | 'complex'
  | 'intelligent'
  | 'earlyCiv'
  | 'farming'
  | 'industrial'
  | 'nuclear'
  | 'spaceAge';

export type PlanetStatus =
  | 'none'
  | 'lavaHot'
  | 'frigidIce'
  | 'habitable'
  | 'nuclearWar'
  | 'deadWorld'
  | 'colonizing'
  | 'colonized';

/** Linear RGB, each channel 0 to 1 (or above 1 for things that glow). */
export type RGB = readonly [number, number, number];

/**
 * One thing on the table. Position and velocity are in world units on the
 * z = 0 plane (1 unit = 1 CSS pixel, 1 unit per second). Everything under
 * "derived" is recomputed by refreshDerived in stars.ts and must not be
 * edited by hand.
 */
export interface Body {
  readonly id: number;
  /** Earth masses. */
  mass: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Acceleration accumulated during the current step. Scratch, owned by gravity.ts. */
  ax: number;
  ay: number;

  // Life story
  /** Seconds lived. For a remnant, seconds since it formed. */
  age: number;
  /** Seconds this star burns for; Infinity for stars that never die. */
  lifetime: number;
  phase: StarPhase;
  remnant: Remnant | null;

  // Derived from mass, phase, remnant, and age
  starClass: StarClass;
  /** World units. */
  radius: number;
  /** Radius used for touch hit tests, never smaller than a fingertip. */
  hitRadius: number;
  /** Suns. Zero for planets and gas giants. */
  luminosity: number;
  /** Kelvin. */
  temperature: number;
  color: RGB;

  // Habitability and civilization (planets only)
  /** Seconds spent in a habitable zone, net of time spent outside. */
  habitableTime: number;
  lifeStage: LifeStage;
  status: PlanetStatus;
  /** Seconds since the status last changed; drives war flashes and colonizing. */
  statusAge: number;
  civId: number | null;

  // Interaction
  /** Pinned to a finger or the mouse. Still pulls on everything, but gravity does not move it. */
  held: boolean;
  /** Ignores gravity from everything else. Still pulls. */
  locked: boolean;
  /** Released onto a circular orbit around its primary. */
  orbiting: boolean;
  /** The body this one orbits, chosen on release. */
  primaryId: number | null;
}

export interface BodyInit {
  mass: number;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
}

/** A spacefaring society. Colonies share the founder's colour. */
export interface Civilization {
  readonly id: number;
  color: RGB;
  homeId: number;
}

/** A colony ship in flight. */
export interface Ship {
  readonly id: number;
  civId: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetId: number;
  age: number;
}

export interface MergeEvent {
  kind: 'merge';
  x: number;
  y: number;
  survivorId: number;
  absorbedId: number;
  /** Name of what remains, for the toast. */
  name: string;
}

export interface DeathEvent {
  kind: 'death';
  x: number;
  y: number;
  bodyId: number;
  /** What was left behind; null for a Type Ia supernova, which leaves nothing. */
  remnant: Remnant | null;
  name: string;
  /** Earth masses thrown off into dust. */
  ejectedMass: number;
  /** Zero for a planetary nebula; the blast radius in world units for a supernova. */
  blastRadius: number;
  /** Radius of the dying star just before death, so effects can scale to it. */
  starRadius: number;
}

export interface IgniteEvent {
  kind: 'ignite';
  x: number;
  y: number;
  bodyId: number;
  name: string;
}

export interface CollapseEvent {
  kind: 'collapse';
  x: number;
  y: number;
  bodyId: number;
  massEarth: number;
}

export interface SwallowEvent {
  kind: 'swallow';
  x: number;
  y: number;
  blackHoleId: number;
  absorbedId: number;
}

export interface GrbEvent {
  kind: 'grb';
  x: number;
  y: number;
  bodyId: number;
}

export interface StageChangeEvent {
  kind: 'stageChange';
  x: number;
  y: number;
  bodyId: number;
  stage: LifeStage;
  status: PlanetStatus;
  label: string;
}

export interface WarEvent {
  kind: 'war';
  x: number;
  y: number;
  bodyId: number;
  cause: 'nuclear' | 'climate' | 'attack' | 'sterilized';
}

export interface ShipLaunchEvent {
  kind: 'shipLaunch';
  x: number;
  y: number;
  bodyId: number;
  civId: number;
}

export interface ColonizeEvent {
  kind: 'colonize';
  x: number;
  y: number;
  bodyId: number;
  civId: number;
  outcome: 'colonizing' | 'colonized' | 'cooperate' | 'attack';
}

/**
 * Something that happened during a step, for the renderer to turn into an
 * effect or a toast. Every event carries the world position it happened at.
 */
export type SimEvent =
  | MergeEvent
  | DeathEvent
  | IgniteEvent
  | CollapseEvent
  | SwallowEvent
  | GrbEvent
  | StageChangeEvent
  | WarEvent
  | ShipLaunchEvent
  | ColonizeEvent;
