import { describe, it, expect, vi, beforeEach } from "vitest";

const rpcMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: vi.fn(),
  },
}));

import { registrarEnvio } from "./envioFornecedor";
import { ENVIO_ACAO } from "./envioStatus";

beforeEach(() => rpcMock.mockReset());

describe("registrarEnvio idempotência (par cotação/fornecedor já existente)", () => {
  it("não quebra quando chamado duas vezes para o mesmo par — RPC sempre resolve", async () => {
    // The RPC uses INSERT ... ON CONFLICT DO NOTHING against the
    // cotacao_fornecedores_cotacao_id_fornecedor_id_key unique constraint,
    // so a second call for the same pair must succeed (returns a new historico id).
    rpcMock
      .mockResolvedValueOnce({ data: "hist-1", error: null })
      .mockResolvedValueOnce({ data: "hist-2", error: null });

    const first = await registrarEnvio({
      cotacaoId: "c1",
      fornecedorId: "f1",
      acao: ENVIO_ACAO.ENVIO_INICIAL,
    });
    const second = await registrarEnvio({
      cotacaoId: "c1",
      fornecedorId: "f1",
      acao: ENVIO_ACAO.REENVIO,
    });

    expect(first).toBe("hist-1");
    expect(second).toBe("hist-2");
    expect(rpcMock).toHaveBeenCalledTimes(2);
  });
});
