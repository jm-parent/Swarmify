import { describe, expect, it } from "vitest";
import { DEFAULT_SVG_SIZE, fitImageSize } from "./images";

describe("images", () => {
  // Le module ne touche pas le DOM à l'import : il doit se charger sous Node.
  it("se charge sans DOM", async () => {
    await expect(import("./images")).resolves.toMatchObject({ MAX_CARD_WIDTH: 480 });
  });

  it("plafonne la largeur à 480 px en conservant les proportions", () => {
    expect(fitImageSize({ width: 960, height: 640 })).toEqual({ width: 480, height: 320 });
  });

  it("n'agrandit pas une image déjà plus petite que le plafond", () => {
    expect(fitImageSize({ width: 200, height: 100 })).toEqual({ width: 200, height: 100 });
  });

  it("utilise la taille par défaut pour un SVG sans dimensions", () => {
    expect(fitImageSize({ width: 0, height: 0 })).toEqual(DEFAULT_SVG_SIZE);
  });
});
