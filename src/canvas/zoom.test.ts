import { describe, expect, it } from "vitest";
import { formatZoom } from "./zoom";

describe("formatZoom", () => {
  it("affiche le pourcentage entier", () => {
    expect(formatZoom(1)).toBe("100 %");
    expect(formatZoom(0.1234)).toBe("12 %");
  });

  it("arrondit sans afficher de décimales", () => {
    expect(formatZoom(0.505)).toBe("51 %");
  });
});
