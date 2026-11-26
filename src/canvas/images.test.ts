import { describe, expect, it } from "vitest";

describe("images", () => {
  // Le module ne touche pas le DOM à l'import : il doit se charger sous Node.
  it("se charge sans DOM", async () => {
    await expect(import("./images")).resolves.toMatchObject({ MAX_CARD_WIDTH: 480 });
  });
});
