/**
 * Versão única de assets, injetada no build via vite.config.ts (define).
 * Usada para invalidar caches de imagens (logos, OG image, etc.) sem
 * precisar atualizar URLs manualmente em cada página.
 *
 * Para forçar atualização futura, basta rebuildar — o timestamp do build
 * gera um novo valor e todas as URLs ganham um `?v=<novo>` automaticamente.
 */
declare const __ASSET_VERSION__: string;

export const ASSET_VERSION: string =
  typeof __ASSET_VERSION__ !== "undefined" ? __ASSET_VERSION__ : "dev";

/** Anexa `?v=ASSET_VERSION` (ou `&v=...` se já houver query) à URL. */
export const withAssetVersion = (url: string): string => {
  if (!url) return url;
  // Não versionar data: ou blob:
  if (/^(data|blob):/i.test(url)) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${ASSET_VERSION}`;
};
