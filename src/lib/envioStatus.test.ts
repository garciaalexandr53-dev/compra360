import { describe, it, expect } from "vitest";
import {
  ENVIO_STATUS,
  ENVIO_ACAO,
  ENVIO_ORIGEM,
  acaoParaEnvio,
  statusMeta,
  acaoLabel,
  origemLabel,
} from "./envioStatus";

describe("envioStatus constants", () => {
  it("exposes all 4 statuses with labels and badge classes", () => {
    const all = Object.values(ENVIO_STATUS);
    expect(all).toHaveLength(4);
    all.forEach((s) => {
      expect(statusMeta[s].label).toBeTruthy();
      expect(statusMeta[s].badge).toContain("border");
    });
  });

  it("exposes all 3 actions and 2 origens with labels", () => {
    expect(Object.values(ENVIO_ACAO)).toHaveLength(3);
    expect(Object.values(ENVIO_ORIGEM)).toHaveLength(2);
    Object.values(ENVIO_ACAO).forEach((a) => expect(acaoLabel[a]).toBeTruthy());
    Object.values(ENVIO_ORIGEM).forEach((o) => expect(origemLabel[o]).toBeTruthy());
  });
});

describe("acaoParaEnvio transition logic", () => {
  it("returns envio_inicial when status is pendente / null / undefined", () => {
    expect(acaoParaEnvio(ENVIO_STATUS.PENDENTE)).toBe(ENVIO_ACAO.ENVIO_INICIAL);
    expect(acaoParaEnvio(null)).toBe(ENVIO_ACAO.ENVIO_INICIAL);
    expect(acaoParaEnvio(undefined)).toBe(ENVIO_ACAO.ENVIO_INICIAL);
  });

  it("returns reenvio for already-enviado / entregue / falhou", () => {
    expect(acaoParaEnvio(ENVIO_STATUS.ENVIADO)).toBe(ENVIO_ACAO.REENVIO);
    expect(acaoParaEnvio(ENVIO_STATUS.ENTREGUE)).toBe(ENVIO_ACAO.REENVIO);
    expect(acaoParaEnvio(ENVIO_STATUS.FALHOU)).toBe(ENVIO_ACAO.REENVIO);
  });
});
