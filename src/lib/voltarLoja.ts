/**
 * Gerencia o ciclo de vida do "retorno para o LojaSheet".
 *
 * Fluxo:
 * 1. `markVoltarLoja(id)` — chamado no LojaSheet ao navegar para uma página de destino.
 *    Persiste `{id, ts}` em sessionStorage.
 * 2. `signalVoltarIntent()` — chamado no BackToLojaButton ao clicar.
 *    Marca a intenção explícita do usuário de voltar para o sheet.
 * 3. `consumeVoltarLoja()` — chamado no LojasPage ao montar.
 *    Só restaura o sheet se houver intent + ts dentro da TTL.
 *    Sempre limpa as duas chaves após a leitura.
 * 4. `clearVoltarLoja()` — limpa explicitamente em desmontagem ou troca de loja.
 *
 * Sem intent: navegações para /lojas via menu/sidebar NÃO reabrem o sheet.
 * Com TTL: navegação tardia (>2min) também NÃO reabre.
 */

const KEY_ID = "voltar_loja_id";
const KEY_TS = "voltar_loja_ts";
const KEY_INTENT = "voltar_loja_intent";
const TTL_MS = 2 * 60 * 1000; // 2 minutos

const safeStorage = (): Storage | null => {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
};

export function markVoltarLoja(id: string): void {
  const s = safeStorage();
  if (!s) return;
  s.setItem(KEY_ID, id);
  s.setItem(KEY_TS, String(Date.now()));
  // Limpa intent residual: cada nova navegação parte de zero.
  s.removeItem(KEY_INTENT);
}

export function signalVoltarIntent(): void {
  const s = safeStorage();
  if (!s) return;
  s.setItem(KEY_INTENT, "1");
}

export function consumeVoltarLoja(): string | null {
  const s = safeStorage();
  if (!s) return null;
  const id = s.getItem(KEY_ID);
  const tsRaw = s.getItem(KEY_TS);
  const intent = s.getItem(KEY_INTENT);

  // Sempre limpa, qualquer que seja o resultado.
  s.removeItem(KEY_ID);
  s.removeItem(KEY_TS);
  s.removeItem(KEY_INTENT);

  if (!id || !tsRaw || intent !== "1") return null;
  const ts = Number(tsRaw);
  if (!Number.isFinite(ts) || Date.now() - ts > TTL_MS) return null;
  return id;
}

export function clearVoltarLoja(): void {
  const s = safeStorage();
  if (!s) return;
  s.removeItem(KEY_ID);
  s.removeItem(KEY_TS);
  s.removeItem(KEY_INTENT);
}
