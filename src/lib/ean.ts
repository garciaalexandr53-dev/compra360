/** Código de barras aceito: 4 a 14 dígitos (inclui códigos internos curtos). Fora disso vira null. */
export function normalizarEan(v: string | null | undefined): string | null {
  const s = (v ?? "").replace(/\s/g, "");
  return /^\d{4,14}$/.test(s) ? s : null;
}
