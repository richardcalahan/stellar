import { describe, expect, it } from 'vitest';
import { layoutPalettes } from '../layout';

describe('layoutPalettes', () => {
  it('puts one card at the bottom centre by default', () => {
    const slots = layoutPalettes(1920, 1080);
    expect(slots).toHaveLength(1);
    expect(slots[0]?.x).toBe(960);
    expect(slots[0]?.rotation).toBe(0);
    expect(slots[0]?.y).toBeGreaterThan(1000);
  });

  it('puts four cards in the corners at 1920 wide on a table, the top pair upside down', () => {
    const slots = layoutPalettes(1920, 1080, false);
    expect(slots).toHaveLength(4);
    expect(slots.filter((s) => s.rotation === 180)).toHaveLength(2);
    expect(slots.filter((s) => s.rotation === 0)).toHaveLength(2);
    for (const slot of slots) {
      expect(slot.x).toBeGreaterThan(0);
      expect(slot.x).toBeLessThan(1920);
    }
  });

  it('puts eight cards around a 4K table', () => {
    const slots = layoutPalettes(3840, 2160, false);
    expect(slots).toHaveLength(8);
    expect(slots.filter((s) => s.rotation === 180)).toHaveLength(3);
    expect(slots.filter((s) => s.rotation === 0)).toHaveLength(3);
    expect(slots.filter((s) => s.rotation === 90)).toHaveLength(1);
    expect(slots.filter((s) => s.rotation === 270)).toHaveLength(1);
  });
});
