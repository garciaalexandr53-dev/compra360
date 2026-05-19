import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import PerfilPage from "./PerfilPage";

// ----- Mocks -----
const profileRow = { nome: "João Silva", whatsapp: "11987654321" };
const lojaRow = {
  nome: "Mercado X",
  cnpj: "12345678000199",
  razao_social: "Mercado X LTDA",
  inscricao_estadual: "ISENTO",
  endereco: "Rua A, 100",
  telefone: "1133334444",
};

const upsertMock = vi.fn(() => Promise.resolve({ error: null }));
const updateEqMock = vi.fn(() => Promise.resolve({ error: null }));
const resetPasswordMock = vi.fn(() => Promise.resolve({ error: null }));

let profileMaybeError: any = null;
let lojaMaybeError: any = null;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: profileRow, error: profileMaybeError }),
            }),
          }),
          upsert: (...args: any[]) => upsertMock(...args),
        };
      }
      if (table === "lojas") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: lojaRow, error: lojaMaybeError }),
            }),
            order: () => Promise.resolve({ data: [], error: null }),
          }),
          update: (payload: any) => ({
            eq: (...a: any[]) => updateEqMock(payload, ...a),
          }),
        };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) };
    },
    auth: {
      resetPasswordForEmail: (...args: any[]) => resetPasswordMock(...args),
    },
  },
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1", email: "joao@x.com" } }),
}));

vi.mock("@/hooks/useLojaAtiva", () => ({
  useLojaAtiva: () => ({ lojaAtiva: { id: "loja-1", nome: "Mercado X" } }),
}));

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

const wrap = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <PerfilPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  upsertMock.mockClear();
  updateEqMock.mockClear();
  resetPasswordMock.mockClear();
  toastSuccess.mockClear();
  toastError.mockClear();
  profileMaybeError = null;
  lojaMaybeError = null;
});

describe("PerfilPage", () => {
  it("carrega dados do profile e da loja com máscaras aplicadas", async () => {
    wrap();
    await waitFor(() => {
      expect((screen.getByLabelText(/Nome completo/i) as HTMLInputElement).value).toBe("João Silva");
    });
    expect((screen.getByLabelText(/^Telefone$/i) as HTMLInputElement).value).toBe("(11) 98765-4321");
    expect((screen.getByLabelText(/Email/i) as HTMLInputElement).value).toBe("joao@x.com");
    expect((screen.getByLabelText(/Nome da loja/i) as HTMLInputElement).value).toBe("Mercado X");
    expect((screen.getByLabelText(/CNPJ/i) as HTMLInputElement).value).toBe("12.345.678/0001-99");
    expect((screen.getByLabelText(/Telefone da loja/i) as HTMLInputElement).value).toBe("(11) 3333-4444");
  });

  it("edita campos e salva com sucesso (upsert + update + toast)", async () => {
    wrap();
    await waitFor(() => screen.getByLabelText(/Nome completo/i));

    fireEvent.change(screen.getByLabelText(/Nome completo/i), { target: { value: "Maria" } });
    fireEvent.change(screen.getByLabelText(/Nome da loja/i), { target: { value: "Mercado Y" } });

    fireEvent.click(screen.getByRole("button", { name: /Salvar alterações/i }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Dados atualizados com sucesso"));

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const upsertPayload = upsertMock.mock.calls[0][0] as any;
    expect(upsertPayload.user_id).toBe("user-1");
    expect(upsertPayload.nome).toBe("Maria");
    expect(upsertPayload.whatsapp).toBe("11987654321");

    expect(updateEqMock).toHaveBeenCalledTimes(1);
    const [updatePayload, col, val] = updateEqMock.mock.calls[0];
    expect((updatePayload as any).nome).toBe("Mercado Y");
    expect((updatePayload as any).cnpj).toBe("12345678000199");
    expect(col).toBe("id");
    expect(val).toBe("loja-1");
  });

  it("bloqueia salvamento com CNPJ inválido e mostra toast de erro", async () => {
    wrap();
    await waitFor(() => screen.getByLabelText(/CNPJ/i));

    fireEvent.change(screen.getByLabelText(/CNPJ/i), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar alterações/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("CNPJ inválido"));
    expect(upsertMock).not.toHaveBeenCalled();
    expect(updateEqMock).not.toHaveBeenCalled();
  });

  it("bloqueia salvamento com telefone pessoal inválido", async () => {
    wrap();
    await waitFor(() => screen.getByLabelText(/^Telefone$/i));

    fireEvent.change(screen.getByLabelText(/^Telefone$/i), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar alterações/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Telefone pessoal inválido"));
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("mostra toast de erro quando upsert do profile falha", async () => {
    upsertMock.mockImplementationOnce(() =>
      Promise.resolve({ error: { message: "falha ao salvar profile" } }),
    );
    wrap();
    await waitFor(() => screen.getByLabelText(/Nome completo/i));

    fireEvent.click(screen.getByRole("button", { name: /Salvar alterações/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("falha ao salvar profile"));
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("envia email de redefinição de senha", async () => {
    wrap();
    await waitFor(() => screen.getByRole("button", { name: /Alterar senha/i }));

    fireEvent.click(screen.getByRole("button", { name: /Alterar senha/i }));

    await waitFor(() => expect(resetPasswordMock).toHaveBeenCalledTimes(1));
    expect(resetPasswordMock.mock.calls[0][0]).toBe("joao@x.com");
    expect(toastSuccess).toHaveBeenCalledWith("Email de redefinição enviado");
  });

  it("mostra erro quando reset de senha falha", async () => {
    resetPasswordMock.mockImplementationOnce(() =>
      Promise.resolve({ error: { message: "rate limited" } }),
    );
    wrap();
    await waitFor(() => screen.getByRole("button", { name: /Alterar senha/i }));

    fireEvent.click(screen.getByRole("button", { name: /Alterar senha/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("rate limited"));
  });
});
