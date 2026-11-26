import { describe, expect, it } from "vitest";
import { DEFAULT_SVG_SIZE, fitImageSize, importImageFiles, isImageFileName, joinImagePath } from "./images";

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

  it("accepte les noms `<uuid>.<ext>` produits par import_image", () => {
    const uuid = "0f1e2d3c-4b5a-4968-8777-a6b5c4d3e2f1";
    for (const ext of ["png", "jpg", "gif", "webp", "svg"]) {
      expect(isImageFileName(`${uuid}.${ext}`)).toBe(true);
    }
  });

  it("rejette les noms qui sortent de images/ ou ne sont pas des fichiers image attendus", () => {
    const uuid = "0f1e2d3c-4b5a-4968-8777-a6b5c4d3e2f1";
    for (const bad of [
      `../${uuid}.png`,
      `..\\${uuid}.png`,
      `${uuid}.png/../x`,
      `C:\\secret\\${uuid}.png`,
      `${uuid}.jpeg`,
      `${uuid}.exe`,
      `${uuid.toUpperCase()}.png`,
      `${uuid}`,
      "",
    ]) {
      expect(isImageFileName(bad), bad).toBe(false);
    }
  });

  it("joint le dossier et le nom avec le séparateur déjà présent dans le dossier", () => {
    expect(joinImagePath("C:\\Users\\me\\AppData\\images", "f.png")).toBe("C:\\Users\\me\\AppData\\images\\f.png");
    expect(joinImagePath("/home/me/.local/share/images", "f.png")).toBe("/home/me/.local/share/images/f.png");
  });

  it("refuse un import sans position pour chaque fichier, avant tout appel système", async () => {
    await expect(importImageFiles(["a.png", "b.png"], [{ x: 0, y: 0 }])).rejects.toThrow("positions manquantes");
  });
});
