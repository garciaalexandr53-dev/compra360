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
});

describe("FATOR_PADRAO - cobertura completa do mapa", () => {
  it("contém todas as siglas suportadas com valores numéricos positivos", () => {
    const esperadas = ["UNI", "CX", "DZ", "½DZ", "DP", "FD", "PCT", "KG", "LT", "SC", "GL"];
    esperadas.forEach((sigla) => {
      expect(FATOR_PADRAO).toHaveProperty(sigla);
      expect(typeof FATOR_PADRAO[sigla]).toBe("number");
      expect(FATOR_PADRAO[sigla]).toBeGreaterThan(0);
    });
  });

  it("valores canônicos estão corretos", () => {
    expect(FATOR_PADRAO.UNI).toBe(1);
    expect(FATOR_PADRAO.CX).toBe(12);
    expect(FATOR_PADRAO.DZ).toBe(12);
    expect(FATOR_PADRAO["½DZ"]).toBe(6);
    expect(FATOR_PADRAO.DP).toBe(12);
    expect(FATOR_PADRAO.FD).toBe(6);
    expect(FATOR_PADRAO.PCT).toBe(1);
    expect(FATOR_PADRAO.KG).toBe(1);
    expect(FATOR_PADRAO.LT).toBe(1);
    expect(FATOR_PADRAO.SC).toBe(1);
    expect(FATOR_PADRAO.GL).toBe(1);
  });

  it("toda sigla do diálogo possui entrada no FATOR_PADRAO", () => {
    EMBALAGENS_DIALOG.forEach((sigla) => {
      expect(FATOR_PADRAO[sigla]).toBeDefined();
    });
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

describe("getFatorPadrao - normalização expandida", () => {
  it("misto de maiúsculas e minúsculas", () => {
    expect(getFatorPadrao("Cx")).toBe(12);
    expect(getFatorPadrao("Dp")).toBe(12);
    expect(getFatorPadrao("dZ")).toBe(12);
    expect(getFatorPadrao("Fd")).toBe(6);
  });

  it("apenas espaços/tabs/quebras → fallback 1", () => {
    expect(getFatorPadrao("   ")).toBe(1);
    expect(getFatorPadrao("\t")).toBe(1);
    expect(getFatorPadrao("\n")).toBe(1);
  });

  it("preserva caractere especial ½ ao normalizar", () => {
    expect(getFatorPadrao("½dz")).toBe(6);
    expect(getFatorPadrao(" ½DZ ")).toBe(6);
  });
});

describe("matchEmbalagem - fallback e variações", () => {
  it("retorna a sigla correta para entradas exatas", () => {
    expect(matchEmbalagem("CX")).toBe("CX");
    expect(matchEmbalagem("DP")).toBe("DP");
    expect(matchEmbalagem("UNI")).toBe("UNI");
  });

  it("normaliza prefixos com descrição/quantidade", () => {
    expect(matchEmbalagem("CX 24un")).toBe("CX");
    expect(matchEmbalagem("DP 12")).toBe("DP");
    expect(matchEmbalagem("FD 6 unidades")).toBe("FD");
  });

  it("normaliza minúsculas e usa o pipe como separador", () => {
    expect(matchEmbalagem("dp")).toBe("DP");
    expect(matchEmbalagem("cx|24")).toBe("CX");
  });

  it("aplica fallback UNI para entradas inválidas", () => {
    expect(matchEmbalagem(null)).toBe("UNI");
    expect(matchEmbalagem(undefined)).toBe("UNI");
    expect(matchEmbalagem("")).toBe("UNI");
    expect(matchEmbalagem("xyz")).toBe("UNI");
    expect(matchEmbalagem("desconhecido")).toBe("UNI");
  });
});

describe("resolveFatorInicial - integração com FATOR_PADRAO", () => {
  it("usa fator cadastrado quando válido (>0)", () => {
    expect(resolveFatorInicial("CX", 24)).toBe(24);
    expect(resolveFatorInicial("DP", 18)).toBe(18);
    expect(resolveFatorInicial("UNI", 3)).toBe(3);
  });

  it("usa padrão quando cadastrado é 0, null ou undefined", () => {
    expect(resolveFatorInicial("CX", 0)).toBe(12);
    expect(resolveFatorInicial("DP", null)).toBe(12);
    expect(resolveFatorInicial("FD", undefined)).toBe(6);
    expect(resolveFatorInicial("UNI", null)).toBe(1);
    expect(resolveFatorInicial("½DZ", 0)).toBe(6);
  });

  it("usa padrão quando cadastrado é negativo", () => {
    expect(resolveFatorInicial("CX", -5)).toBe(12);
  });

  it("fallback para sigla desconhecida retorna 1", () => {
    expect(resolveFatorInicial("XYZ", null)).toBe(1);
    expect(resolveFatorInicial("XYZ", 0)).toBe(1);
  });

  it("respeita o cadastrado mesmo para sigla desconhecida", () => {
    expect(resolveFatorInicial("XYZ", 8)).toBe(8);
  });
});
