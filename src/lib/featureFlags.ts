/**
 * Fonte única de verdade para feature flags da aplicação.
 * Mantenha as flags experimentais desligadas por padrão.
 */
export const featureFlags = {
  /** OCR de nota fiscal na aba Conferência (botão + relatório). */
  ocrNotaFiscal: false,
} as const;

export type FeatureFlag = keyof typeof featureFlags;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return featureFlags[flag] === true;
}
