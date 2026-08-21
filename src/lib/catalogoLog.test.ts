import { describe, it, expect } from "vitest";
import {
  diffLog,
  formatarValorLog,
  labelAcao,
  nomeItemLog,
  resolverAutor,
} from "./catalogoLog";

describe("formatarValorLog", () => {
  it("formata vazios, booleanos e números", () => {
    expect(formatarValorLog(null)).toBe("—");
    expect(formatarValorLog("")).toBe("—");
    expect(formatarValorLog(true)).toBe("Sim");
    expect(formatarValorLog(false)).toBe("Não");
    expect(formatarValorLog(12)).toBe("12");
    expect(formatarValorLog("CX")).toBe("CX");
  });
});

describe("diffLog", () => {
  it("UPDATE lista apenas campos alterados e ignora id", () => {
    const d = diffLog({
      acao: "UPDATE",
      dados_antes: { id: "a", nome: "Arroz", fator_embalagem: 1, ativo: true },
      dados_depois: { id: "b", nome: "Arroz Tipo 1", fator_embalagem: 1, ativo: true },
    });
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ campo: "nome", antes: "Arroz", depois: "Arroz Tipo 1" });
  });

  it("UPDATE detecta troca de boolean", () => {
    const d = diffLog({ acao: "UPDATE", dados_antes: { ativo: true }, dados_depois: { ativo: false } });
    expect(d[0]).toMatchObject({ label: "Ativo", antes: "Sim", depois: "Não" });
  });

  it("INSERT mostra valores criados", () => {
    const d = diffLog({ acao: "INSERT", dados_antes: null, dados_depois: { id: "x", nome: "Feijão", ean: null } });
    expect(d.map((x) => x.campo)).toEqual(["nome", "ean"]);
    expect(d[0].antes).toBe("—");
    expect(d[1].depois).toBe("—");
  });

  it("DELETE mostra valores removidos", () => {
    const d = diffLog({ acao: "DELETE", dados_antes: { nome: "Sal" }, dados_depois: null });
    expect(d[0]).toMatchObject({ antes: "Sal", depois: "—" });
  });

  it("retorna vazio quando nada mudou", () => {
    expect(diffLog({ acao: "UPDATE", dados_antes: { nome: "A" }, dados_depois: { nome: "A" } })).toHaveLength(0);
  });
});

describe("nomeItemLog", () => {
  it("prefere dados_depois e cai para dados_antes", () => {
    expect(nomeItemLog({ dados_antes: { nome: "Velho" }, dados_depois: { nome: "Novo" } })).toBe("Novo");
    expect(nomeItemLog({ dados_antes: { nome: "Velho" }, dados_depois: null })).toBe("Velho");
    expect(nomeItemLog({ dados_antes: null, dados_depois: null })).toBe("(sem nome)");
  });
});

describe("resolverAutor", () => {
  const mapa = { "11111111-2222": "cliente@ex.com" };
  it("segue a ordem: você, e-mail, uuid, sistema", () => {
    expect(resolverAutor(null, "u1", mapa)).toBe("Sistema");
    expect(resolverAutor("u1", "u1", mapa)).toBe("Você");
    expect(resolverAutor("11111111-2222", "u1", mapa)).toBe("cliente@ex.com");
    expect(resolverAutor("abcdefgh-9999", "u1", mapa)).toBe("abcdefgh…");
  });
});

describe("labelAcao", () => {
  it("traduz as ações", () => {
    expect(labelAcao("INSERT")).toBe("Criado");
    expect(labelAcao("UPDATE")).toBe("Editado");
    expect(labelAcao("DELETE")).toBe("Removido");
  });
});
