import { describe, it, expect, vi, afterEach } from "vitest";
import { buscarCep, cepCompleto, somenteDigitosCep } from "./cep";

const mockFetch = (impl: any) => {
  vi.stubGlobal("fetch", impl);
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("somenteDigitosCep / cepCompleto", () => {
  it("limpa e limita a 8 dígitos", () => {
    expect(somenteDigitosCep("05127-174")).toBe("05127174");
    expect(somenteDigitosCep("abc0512717499")).toBe("05127174");
  });
  it("valida CEP completo", () => {
    expect(cepCompleto("05127-174")).toBe(true);
    expect(cepCompleto("0512717")).toBe(false);
  });
});

describe("buscarCep", () => {
  it("retorna null para CEP incompleto sem chamar a rede", async () => {
    const f = vi.fn();
    mockFetch(f);
    expect(await buscarCep("123")).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it("usa BrasilAPI quando disponível", async () => {
    mockFetch(async () => ({ ok: true, json: async () => ({ city: "Cianorte", state: "PR" }) }));
    const r = await buscarCep("87200-000");
    expect(r).toMatchObject({ cidade: "Cianorte", uf: "PR" });
  });

  it("cai para o ViaCEP quando a BrasilAPI falha", async () => {
    let chamada = 0;
    mockFetch(async () => {
      chamada += 1;
      if (chamada === 1) throw new Error("offline");
      return { ok: true, json: async () => ({ localidade: "São Tomé", uf: "pr" }) };
    });
    const r = await buscarCep("87200000");
    expect(r).toMatchObject({ cidade: "São Tomé", uf: "PR" });
  });

  it("retorna null quando nenhum serviço encontra o CEP", async () => {
    mockFetch(async () => ({ ok: true, json: async () => ({ erro: true }) }));
    expect(await buscarCep("00000000")).toBeNull();
  });
});
