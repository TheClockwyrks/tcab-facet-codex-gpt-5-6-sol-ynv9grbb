import { describe, expect, it } from "vitest";
import { BACKGROUND, game } from "./game";

describe("Facet game contract", () => {
  it("exports the complete engine lifecycle", () => {
    expect(BACKGROUND).toMatch(/^#/);
    expect(game.initialize).toBeTypeOf("function");
    expect(game.update).toBeTypeOf("function");
    expect(game.render).toBeTypeOf("function");
  });
});
