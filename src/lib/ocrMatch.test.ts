import { describe, it, expect } from "vitest";
import { encontrarMelhorMatch, similaridade, tokenizar } from "./ocrMatch";

const pedido = [
  "Aveia Bebida Lactea Uht Com Aveia 1L",
  "Fumo Galo 30G",
  "Raticida Fenomeno 25G",
  "Achocolatado Nescau 350G",
  "Pinga Jamel 1L com casco",
  "Creme De Leite Lider 200G",
];

describe("ocrMatch", () => {
  it("casa abreviações da nota com o nome do catálogo", () => {
    expect(encontrarMelhorMatch("BEB.LACTEA LIDER 1LT AVEIA", pedido)).toBe(0);
    expect(encontrarMelhorMatch("FUMO GALO (50X30 GRS) DESFIADO", pedido)).toBe(1);
    expect(encontrarMelhorMatch("RATICIDA FENOMENO GRANULADO 24X25", pedido)).toBe(2);
    expect(encontrarMelhorMatch("CREME LEITE LIDER 200GR TP", pedido)).toBe(5);
  });

  it("não casa produtos diferentes", () => {
    expect(encontrarMelhorMatch("AGUA SANITARIA Q'BOA TRADICIONAL 12X1", pedido)).toBe(-1);
    expect(encontrarMelhorMatch("COTONETE JOHNSON & JOHNSON 75 UNIDADE", pedido)).toBe(-1);
  });

  it("respeita índices já usados e escolhe o melhor candidato", () => {
    const usados = new Set([0]);
    expect(encontrarMelhorMatch("BEB.LACTEA LIDER 1LT AVEIA", pedido, usados)).toBe(-1);
    expect(similaridade("FUMO GALO 30 GRS", "Fumo Galo 30G")).toBeGreaterThan(0.7);
  });

  it("tokeniza separando número de unidade", () => {
    expect(tokenizar("BEB.LACTEA 1LT")).toEqual(["bebida", "lactea", "1", "l"]);
  });
});
