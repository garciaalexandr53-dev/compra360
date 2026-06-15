import { describe, it, expect } from "vitest";
import { deriveMetadataNome, deriveProfileState } from "./useProfile";

// Pure helper mirroring useProfile's primeiroNome derivation,
// kept inline to avoid mocking supabase/react-query in this unit test.
function derivePrimeiroNome(nome: string | null | undefined): string | null {
  if (!nome) return null;
  const trimmed = nome.trim();
  if (!trimmed) return null;
  return trimmed.split(" ")[0] || null;
}

describe("useProfile - primeiroNome", () => {
  it("retorna null quando nome é null", () => {
    expect(derivePrimeiroNome(null)).toBeNull();
  });

  it("retorna null quando nome é undefined", () => {
    expect(derivePrimeiroNome(undefined)).toBeNull();
  });

  it("retorna null quando nome é string vazia ou só espaços", () => {
    expect(derivePrimeiroNome("")).toBeNull();
    expect(derivePrimeiroNome("   ")).toBeNull();
  });

  it("extrai o primeiro nome de um nome composto", () => {
    expect(derivePrimeiroNome("João da Silva")).toBe("João");
    expect(derivePrimeiroNome("  Maria Aparecida  ")).toBe("Maria");
  });

  it("retorna o próprio nome se for único", () => {
    expect(derivePrimeiroNome("Carlos")).toBe("Carlos");
  });
});

describe("deriveProfileState", () => {
  it("não solicita nome enquanto o profile ainda está carregando", () => {
    expect(deriveProfileState(undefined, true, false).precisaNome).toBe(false);
  });

  it("não solicita nome antes da query terminar (evita flash do modal)", () => {
    expect(deriveProfileState(undefined, false, false).precisaNome).toBe(false);
  });

  it("não solicita nome quando o profile já possui nome salvo", () => {
    const state = deriveProfileState({ nome: "  João Silva  ", whatsapp: null }, false, true);
    expect(state.nome).toBe("João Silva");
    expect(state.primeiroNome).toBe("João");
    expect(state.precisaNome).toBe(false);
  });

  it("solicita nome apenas após carregar e confirmar que está vazio", () => {
    expect(deriveProfileState({ nome: "   ", whatsapp: null }, false, true).precisaNome).toBe(true);
    expect(deriveProfileState(null, false, true).precisaNome).toBe(true);
  });

  it("usa o nome do login como fallback para não pedir novamente", () => {
    const state = deriveProfileState({ nome: "   ", whatsapp: null }, false, true, "Maria Login");
    expect(state.nome).toBe("Maria Login");
    expect(state.primeiroNome).toBe("Maria");
    expect(state.precisaNome).toBe(false);
  });
});

describe("deriveMetadataNome", () => {
  it("lê nomes vindos dos metadados do provedor de login", () => {
    expect(deriveMetadataNome({ full_name: " Ana Souza " })).toBe("Ana Souza");
    expect(deriveMetadataNome({ name: "Carlos Lima" })).toBe("Carlos Lima");
    expect(deriveMetadataNome({ display_name: "Mercado Admin" })).toBe("Mercado Admin");
  });

  it("prioriza o nome informado no app", () => {
    expect(deriveMetadataNome({ nome: "João App", full_name: "João Google" })).toBe("João App");
  });
});
