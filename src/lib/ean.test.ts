import { describe, it, expect } from "vitest";
import { normalizarEan } from "./ean";

describe("normalizarEan", () => {
  it("aceita EAN-13 e códigos curtos", () => {
    expect(normalizarEan("7891000368572")).toBe("7891000368572");
    expect(normalizarEan("343077")).toBe("343077");
    expect(normalizarEan("7733")).toBe("7733");
    expect(normalizarEan(" 7891 ")).toBe("7891");
  });
  it("descarta inválidos", () => {
    expect(normalizarEan("123")).toBeNull();
    expect(normalizarEan("123456789012345")).toBeNull();
    expect(normalizarEan("78A91")).toBeNull();
    expect(normalizarEan(null)).toBeNull();
  });
});
