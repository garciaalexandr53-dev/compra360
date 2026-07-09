import { describe, it, expect } from "vitest";
import { extractEan } from "./ImportErpModal";

describe("extractEan", () => {
  it("returns only digits from EAN column value", () => {
    expect(extractEan("7 891234 567890")).toBe("7891234567890");
    expect(extractEan("789-1234-567890")).toBe("7891234567890");
    expect(extractEan("'07891234567890")).toBe("07891234567890");
  });

  it("preserves leading zeros and GTIN-14", () => {
    expect(extractEan("00789123456789")).toBe("00789123456789");
    expect(extractEan("12345678901234")).toBe("12345678901234");
  });

  it("returns null when no digits", () => {
    expect(extractEan("")).toBeNull();
    expect(extractEan("   ")).toBeNull();
    expect(extractEan("abc")).toBeNull();
    expect(extractEan(null)).toBeNull();
    expect(extractEan(undefined)).toBeNull();
  });

  it("handles numeric inputs (xlsx cells)", () => {
    expect(extractEan(7891234567890)).toBe("7891234567890");
  });
});
