/**
 * Every number that shapes play lives in this file, so exploring the physics
 * is a one-line edit. Module 1 only needs the clock. Later modules add units,
 * G, masses, thresholds, lifetimes, and the rest of the tables.
 */

/** Fixed simulation step in seconds. 240 steps per second keeps fast orbits stable. */
export const DT = 1 / 240;

/** The most simulation steps one frame may run before we drop time instead of catching up. */
export const MAX_SUBSTEPS = 8;

/**
 * The longest real-time gap a single frame is allowed to account for, in seconds.
 * A tab coming back from the background gets this much, not a minute of catch-up.
 */
export const MAX_FRAME_SECONDS = 0.25;
