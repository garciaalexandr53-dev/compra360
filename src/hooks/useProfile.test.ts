import { describe, it, expect } from "vitest";

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
