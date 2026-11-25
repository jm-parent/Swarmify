import { describe, expect, it } from "vitest";
import { radialOffsets } from "./radialLayout";

describe("radialOffsets", () => {
  it("place le premier bouton en haut et répartit les autres à égale distance", () => {
    const offsets = radialOffsets(4, 100);
    expect(offsets[0].x).toBeCloseTo(0);
    expect(offsets[0].y).toBeCloseTo(-100);
    expect(offsets[1].x).toBeCloseTo(100);
    expect(offsets[1].y).toBeCloseTo(0);
    for (const o of offsets) {
      expect(Math.hypot(o.x, o.y)).toBeCloseTo(100);
    }
  });
});
