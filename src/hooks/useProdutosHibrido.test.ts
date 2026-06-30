import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const rpcMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));

import { useProdutosHibrido } from "@/hooks/useProdutosHibrido";

const wrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
};

describe("useProdutosHibrido", () => {
  beforeEach(() => rpcMock.mockReset());

  it("não chama a RPC quando o termo é curto", async () => {
    const { result } = renderHook(() => useProdutosHibrido({ termo: "a" }), {
      wrapper: wrapper(),
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(rpcMock).not.toHaveBeenCalled();
    expect(result.current.data).toEqual([]);
  });

  it("chama search_produtos_hibrido e separa catálogo de locais", async () => {
    rpcMock.mockResolvedValue({
      data: [
        { fonte: "catalogo", id: "c1", nome: "Arroz Tio João 5kg", ean: "789", embalagem: "CX", fator_embalagem: 6 },
        { fonte: "catalogo", id: "c2", nome: "Arroz Camil 1kg", ean: "788", embalagem: "CX", fator_embalagem: 30 },
        { fonte: "local", id: "l1", nome: "Arroz da Casa", ean: null, embalagem: "UNI", fator_embalagem: 1 },
      ],
      error: null,
    });

    const { result } = renderHook(() => useProdutosHibrido({ termo: "arroz" }), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.data.length).toBe(3));
    expect(rpcMock).toHaveBeenCalledWith("search_produtos_hibrido", {
      _termo: "arroz",
      _limit: 50,
    });
    expect(result.current.catalogo).toHaveLength(2);
    expect(result.current.locais).toHaveLength(1);
    expect(result.current.catalogo[0].fonte).toBe("catalogo");
    expect(result.current.locais[0].fonte).toBe("local");
  });

  it("propaga erro da RPC", async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error("boom") });
    const { result } = renderHook(() => useProdutosHibrido({ termo: "leite" }), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.error).toBeTruthy());
  });
});
