import { describe, it, expect } from "vitest";
import { validarCatalogoForm, normalizarNome, similaridadeNome, soDigitos, palavrasChave } from "./catalogoAdmin";

const base = { nome: "Arroz Tipo 1 5kg", ean: "", embalagem: "UNI", fator_embalagem: 1, ativo: true };

describe("validarCatalogoForm", () => {
  it("aceita item mínimo sem EAN", () => {
    const r = validarCatalogoForm(base);
    expect(r.ok).toBe(true);
    expect(r.avisos).toHaveLength(0);
  });

  it("exige nome", () => {
    expect(validarCatalogoForm({ ...base, nome: "  " }).ok).toBe(false);
  });

  it("rejeita fator menor que 1 ou não inteiro", () => {
    expect(validarCatalogoForm({ ...base, fator_embalagem: 0 }).ok).toBe(false);
    expect(validarCatalogoForm({ ...base, fator_embalagem: 1.5 }).ok).toBe(false);
  });

  it("valida tamanho do EAN", () => {
    expect(validarCatalogoForm({ ...base, ean: "7891234567895" }).ok).toBe(true);
    expect(validarCatalogoForm({ ...base, ean: "12345678" }).ok).toBe(true);
    expect(validarCatalogoForm({ ...base, ean: "1234" }).ok).toBe(false);
  });

  it("avisa (sem bloquear) quando embalagem fechada tem fator 1", () => {
    const r = validarCatalogoForm({ ...base, embalagem: "CX", fator_embalagem: 1 });
    expect(r.ok).toBe(true);
    expect(r.avisos[0]).toContain("CX");
  });

  it("não avisa quando embalagem fechada tem fator maior que 1", () => {
    const r = validarCatalogoForm({ ...base, embalagem: "FD", fator_embalagem: 6 });
    expect(r.avisos).toHaveLength(0);
  });

  it("rejeita embalagem fora da lista", () => {
    expect(validarCatalogoForm({ ...base, embalagem: "SC" }).ok).toBe(false);
  });
});

describe("helpers de duplicata", () => {
  it("normaliza acentos e pontuação", () => {
    expect(normalizarNome("Feijão Preto 1Kg (Tipo-1)")).toBe("feijao preto 1kg tipo 1");
  });

  it("extrai até 3 palavras-chave", () => {
    expect(palavrasChave("Leite de Coco Sococo 200ml")).toEqual(["leite", "coco", "sococo"]);
  });

  it("mede similaridade entre nomes", () => {
    expect(similaridadeNome("Leite de Coco 200ml", "Leite de Coco 200ML")).toBe(1);
    expect(similaridadeNome("Arroz 5kg", "Sabão em pó")).toBe(0);
  });

  it("soDigitos remove máscara", () => {
    expect(soDigitos("789-123 456.7895")).toBe("7891234567895");
  });
});
