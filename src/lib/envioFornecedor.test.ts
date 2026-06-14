import { describe, it, expect, vi, beforeEach } from "vitest";

const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import { registrarEnvio, fetchHistoricoEnvios } from "./envioFornecedor";
import { ENVIO_ACAO, ENVIO_ORIGEM, ENVIO_STATUS } from "./envioStatus";

beforeEach(() => {
  rpcMock.mockReset();
  fromMock.mockReset();
});

describe("registrarEnvio", () => {
  it("calls the RPC with default origem=manual and status=enviado", async () => {
    rpcMock.mockResolvedValue({ data: "hist-1", error: null });
    const id = await registrarEnvio({
      cotacaoId: "c1",
      fornecedorId: "f1",
      acao: ENVIO_ACAO.ENVIO_INICIAL,
    });
    expect(id).toBe("hist-1");
    expect(rpcMock).toHaveBeenCalledWith("registrar_envio_fornecedor", expect.objectContaining({
      _cotacao_id: "c1",
      _fornecedor_id: "f1",
      _acao: ENVIO_ACAO.ENVIO_INICIAL,
      _status: ENVIO_STATUS.ENVIADO,
      _origem: ENVIO_ORIGEM.MANUAL,
    }));
  });

  it("forwards reenvio + metadata", async () => {
    rpcMock.mockResolvedValue({ data: "hist-2", error: null });
    await registrarEnvio({
      cotacaoId: "c1",
      fornecedorId: "f1",
      acao: ENVIO_ACAO.REENVIO,
      metadata: { total: 42 },
    });
    const args = rpcMock.mock.calls[0][1];
    expect(args._acao).toBe(ENVIO_ACAO.REENVIO);
    expect(args._metadata).toEqual({ total: 42 });
  });

  it("throws when RPC returns an error", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "denied" } });
    await expect(
      registrarEnvio({ cotacaoId: "c", fornecedorId: "f", acao: ENVIO_ACAO.ENVIO_INICIAL }),
    ).rejects.toEqual({ message: "denied" });
  });
});

describe("fetchHistoricoEnvios", () => {
  it("queries historico_envios with cotacao+fornecedor filter and desc order", async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ id: "h1" }], error: null });
    const eq2 = vi.fn(() => ({ order }));
    const eq1 = vi.fn(() => ({ eq: eq2 }));
    const select = vi.fn(() => ({ eq: eq1 }));
    fromMock.mockReturnValue({ select });

    const rows = await fetchHistoricoEnvios("c1", "f1");
    expect(fromMock).toHaveBeenCalledWith("historico_envios");
    expect(eq1).toHaveBeenCalledWith("cotacao_id", "c1");
    expect(eq2).toHaveBeenCalledWith("fornecedor_id", "f1");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(rows).toEqual([{ id: "h1" }]);
  });
});
