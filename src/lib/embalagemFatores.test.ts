import { describe, it, expect } from "vitest";
import {
  EMBALAGENS_DIALOG,
  FATOR_PADRAO,
  getFatorPadrao,
  matchEmbalagem,
  resolveFatorInicial,
} from "./embalagemFatores";

describe("embalagemFatores - estrutura", () => {
  it("inclui todas as embalagens obrigatórias do diálogo", () => {
    ["UNI", "CX", "DZ", "½DZ", "DP", "FD", "KG", "PCT", "LT"].forEach((s) => {
      expect(EMBALAGENS_DIALOG).toContain(s as any);
    });
  });

  it("FATOR_PADRAO é a fonte única e bate com getFatorPadrao", () => {
    EMBALAGENS_DIALOG.forEach((s) => {
      expect(getFatorPadrao(s)).toBe(FATOR_PADRAO[s]);
    });
  });

  it("normaliza embalagem cadastrada para sigla suportada", () => {
    expect(matchEmbalagem("CX 24un")).toBe("CX");
    expect(matchEmbalagem("dp")).toBe("DP");
    expect(matchEmbalagem(null)).toBe("UNI");
    expect(matchEmbalagem("xyz")).toBe("UNI");
  });

  it("resolveFatorInicial: usa cadastrado se válido, senão padrão", () => {
    expect(resolveFatorInicial("CX", 24)).toBe(24);
    expect(resolveFatorInicial("CX", 0)).toBe(12);
    expect(resolveFatorInicial("DP", null)).toBe(12);
    expect(resolveFatorInicial("UNI", undefined)).toBe(1);
  });
});

describe("getFatorPadrao - 13 casos obrigatórios", () => {
  it("1. UNI → 1", () => expect(getFatorPadrao("UNI")).toBe(1));
  it("2. CX → 12", () => expect(getFatorPadrao("CX")).toBe(12));
  it("3. DZ → 12", () => expect(getFatorPadrao("DZ")).toBe(12));
  it("4. ½DZ → 6", () => expect(getFatorPadrao("½DZ")).toBe(6));
  it("5. DP → 12", () => expect(getFatorPadrao("DP")).toBe(12));
  it("6. FD → 6", () => expect(getFatorPadrao("FD")).toBe(6));
  it("7. KG → 1", () => expect(getFatorPadrao("KG")).toBe(1));
  it("8. PCT → 1", () => expect(getFatorPadrao("PCT")).toBe(1));
  it("9. LT → 1", () => expect(getFatorPadrao("LT")).toBe(1));
  it("10. embalagem desconhecida → 1 (fallback)", () => {
    expect(getFatorPadrao("XYZ")).toBe(1);
    expect(getFatorPadrao("ABC")).toBe(1);
  });
  it("11. minúsculo (ex: 'cx') → normaliza e retorna o fator correto", () => {
    expect(getFatorPadrao("cx")).toBe(12);
    expect(getFatorPadrao("dp")).toBe(12);
    expect(getFatorPadrao("fd")).toBe(6);
  });
  it("12. com espaços (ex: ' CX ') → normaliza e retorna o fator correto", () => {
    expect(getFatorPadrao(" CX ")).toBe(12);
    expect(getFatorPadrao("  dp  ")).toBe(12);
  });
  it("13. undefined/null/vazio → 1", () => {
    expect(getFatorPadrao(undefined)).toBe(1);
    expect(getFatorPadrao(null)).toBe(1);
    expect(getFatorPadrao("")).toBe(1);
  });
});
