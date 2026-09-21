import { describe, it, expect } from "vitest";
import { adicionarCidade, removerCidade, dedupCidades, chaveCidade } from "@/lib/cidades";

describe("cidades atendidas", () => {
  it("não duplica a mesma cidade, ignorando acentos e caixa", () => {
    let lista = adicionarCidade([], { cidade: "Jussara", uf: "PR" });
    lista = adicionarCidade(lista, { cidade: "JUSSARA", uf: "pr" });
    expect(lista).toHaveLength(1);
    expect(lista[0]).toEqual({ cidade: "Jussara", uf: "PR" });
  });

  it("mantém cidades de estados diferentes", () => {
    let lista = adicionarCidade([], { cidade: "Jussara", uf: "PR" });
    lista = adicionarCidade(lista, { cidade: "Jussara", uf: "GO" });
    expect(lista).toHaveLength(2);
  });

  it("ordena alfabeticamente sem considerar acentos", () => {
    let lista = adicionarCidade([], { cidade: "São Tomé", uf: "PR" });
    lista = adicionarCidade(lista, { cidade: "Cianorte", uf: "PR" });
    expect(lista.map((m) => m.cidade)).toEqual(["Cianorte", "São Tomé"]);
  });

  it("ignora cidade vazia", () => {
    expect(adicionarCidade([], { cidade: "   ", uf: "PR" })).toHaveLength(0);
  });

  it("remove a cidade indicada", () => {
    const lista = [
      { cidade: "Cianorte", uf: "PR" },
      { cidade: "Jussara", uf: "PR" },
    ];
    expect(removerCidade(lista, { cidade: "cianorte", uf: "pr" })).toEqual([
      { cidade: "Jussara", uf: "PR" },
    ]);
  });

  it("deduplica a lista vinda do banco", () => {
    const lista = dedupCidades([
      { cidade: "Jussara", uf: "pr" },
      { cidade: " Jussara ", uf: "PR" },
      { cidade: "", uf: "PR" },
    ]);
    expect(lista).toEqual([{ cidade: "Jussara", uf: "PR" }]);
  });

  it("gera chave normalizada", () => {
    expect(chaveCidade({ cidade: "São Tomé", uf: "pr" })).toBe("sao tome|PR");
  });
});
