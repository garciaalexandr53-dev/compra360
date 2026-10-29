import { describe, it, expect } from "vitest";
import { deveAbrirModalNome, nomeDoCadastro } from "./boasVindas";

describe("modal de nome", () => {
  it("não abre quando o nome veio do cadastro", () => {
    expect(deveAbrirModalNome({ precisaNome: true, isAdmin: false, nomeCadastro: "Alexandre" })).toBe(false);
  });
  it("abre para conta antiga sem nome", () => {
    expect(deveAbrirModalNome({ precisaNome: true, isAdmin: false, nomeCadastro: "" })).toBe(true);
  });
  it("não abre quando o perfil já tem nome", () => {
    expect(deveAbrirModalNome({ precisaNome: false, isAdmin: false, nomeCadastro: "" })).toBe(false);
  });
  it("lê o nome dos metadados com espaços removidos", () => {
    expect(nomeDoCadastro({ nome: "  Maria  " })).toBe("Maria");
    expect(nomeDoCadastro({})).toBe("");
  });
});
