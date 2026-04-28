import { describe, it, expect } from "vitest";
import {
  EMBALAGENS_DIALOG,
  FATOR_PADRAO,
  getFatorPadrao,
  matchEmbalagem,
  resolveFatorInicial,
} from "./embalagemFatores";

describe("embalagemFatores", () => {
  it("inclui todas as embalagens obrigatórias do diálogo", () => {
    ["UNI", "CX", "DZ", "½DZ", "DP", "FD", "KG", "PCT", "LT"].forEach((s) => {
      expect(EMBALAGENS_DIALOG).toContain(s as any);
    });
  });

  it("FATOR_PADRAO é a fonte única e bate com getFatorPadrao", () => {
    expect(FATOR_PADRAO.CX).toBe(12);
    expect(FATOR_PADRAO.DP).toBe(12);
    expect(FATOR_PADRAO["½DZ"]).toBe(6);
    expect(FATOR_PADRAO.UNI).toBe(1);
    expect(FATOR_PADRAO.XYZ ?? 1).toBe(1);
    EMBALAGENS_DIALOG.forEach((s) => {
      expect(getFatorPadrao(s)).toBe(FATOR_PADRAO[s]);
    });
  });

  it("retorna fatores padrão corretos por embalagem", () => {
    expect(getFatorPadrao("UNI")).toBe(1);
    expect(getFatorPadrao("CX")).toBe(12);
    expect(getFatorPadrao("DZ")).toBe(12);
    expect(getFatorPadrao("½DZ")).toBe(6);
    expect(getFatorPadrao("DP")).toBe(12);
    expect(getFatorPadrao("FD")).toBe(6);
    expect(getFatorPadrao("KG")).toBe(1);
    expect(getFatorPadrao("PCT")).toBe(1);
    expect(getFatorPadrao("LT")).toBe(1);
  });

  it("normaliza embalagem cadastrada para sigla suportada", () => {
    expect(matchEmbalagem("CX 24un")).toBe("CX");
    expect(matchEmbalagem("dp")).toBe("DP");
    expect(matchEmbalagem(null)).toBe("UNI");
    expect(matchEmbalagem("xyz")).toBe("UNI");
  });

  it("usa fator cadastrado quando válido, senão cai no padrão", () => {
    expect(resolveFatorInicial("CX", 24)).toBe(24);
    expect(resolveFatorInicial("CX", 0)).toBe(12);
    expect(resolveFatorInicial("DP", null)).toBe(12);
    expect(resolveFatorInicial("UNI", undefined)).toBe(1);
  });
});
