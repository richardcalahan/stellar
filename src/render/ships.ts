import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import { isSpacefaring } from '../sim/civilizations';
import { MAX_BODIES, SHIP_CAP } from '../sim/constants';
import type { World } from '../sim/world';
import { prepareInstances } from './bodies';

/** Satellites per spacefaring planet, and how far above the plane and beyond the surface they circle. */
export const SATELLITES_PER_PLANET = 2;
export const SATELLITE_HEIGHT = 5;
export const SATELLITE_CLEARANCE = 7;
export const SATELLITE_SPEED = 2.4;
/** Ships fly this high above the plane so they pass over planets, not through them. */
export const SHIP_HEIGHT = 4;

const UP = new Vector3(1, 0, 0);

/**
 * Colony ships as small elongated boxes in their civilization's colour, and
 * satellites as tiny bright spheres circling above spacefaring planets.
 */
export class ShipsView {
  readonly group = new Group();
  private readonly ships: InstancedMesh;
  private readonly satellites: InstancedMesh;
  private readonly matrix = new Matrix4();
  private readonly position = new Vector3();
  private readonly rotation = new Quaternion();
  private readonly scale = new Vector3(1, 1, 1);
  private readonly heading = new Vector3();
  private readonly color = new Color();

  constructor() {
    this.ships = new InstancedMesh(
      new BoxGeometry(7, 2.2, 2.2),
      new MeshBasicMaterial({ color: 0xffffff }),
      SHIP_CAP,
    );
    this.satellites = new InstancedMesh(
      new SphereGeometry(1.3, 8, 6),
      new MeshBasicMaterial({ color: 0xffffff }),
      MAX_BODIES * SATELLITES_PER_PLANET,
    );
    prepareInstances(this.ships);
    prepareInstances(this.satellites);
    this.group.add(this.ships, this.satellites);
  }

  sync(world: World, time: number): void {
    let count = 0;
    for (const ship of world.ships) {
      if (count >= SHIP_CAP) break;
      const civ = world.civilization(ship.civId);
      this.position.set(ship.x, ship.y, SHIP_HEIGHT);
      this.heading.set(ship.vx, ship.vy, 0).normalize();
      this.rotation.setFromUnitVectors(UP, this.heading);
      this.matrix.compose(this.position, this.rotation, this.scale);
      this.ships.setMatrixAt(count, this.matrix);
      const rgb = civ?.color ?? [1, 1, 1];
      this.ships.setColorAt(count, this.color.setRGB(rgb[0], rgb[1], rgb[2]));
      count++;
    }
    this.ships.count = count;
    this.ships.instanceMatrix.needsUpdate = true;
    if (this.ships.instanceColor) this.ships.instanceColor.needsUpdate = true;

    let sats = 0;
    this.rotation.identity();
    for (const body of world.bodies) {
      if (!isSpacefaring(body)) continue;
      const civ = world.civilization(body.civId);
      const rgb = civ?.color ?? [1, 1, 1];
      const orbit = body.radius + SATELLITE_CLEARANCE;
      for (let k = 0; k < SATELLITES_PER_PLANET; k++) {
        const angle = time * SATELLITE_SPEED + (k * Math.PI * 2) / SATELLITES_PER_PLANET + body.id;
        this.position.set(
          body.x + Math.cos(angle) * orbit,
          body.y + Math.sin(angle) * orbit,
          SATELLITE_HEIGHT,
        );
        this.matrix.compose(this.position, this.rotation, this.scale);
        this.satellites.setMatrixAt(sats, this.matrix);
        this.satellites.setColorAt(sats, this.color.setRGB(rgb[0], rgb[1], rgb[2]));
        sats++;
      }
    }
    this.satellites.count = sats;
    this.satellites.instanceMatrix.needsUpdate = true;
    if (this.satellites.instanceColor) this.satellites.instanceColor.needsUpdate = true;
  }
}
