import { supabase } from "@/integrations/supabase/client";
import {
  ENVIO_ORIGEM,
  ENVIO_STATUS,
  type EnvioAcao,
  type EnvioOrigem,
  type EnvioStatus,
} from "@/lib/envioStatus";

export interface RegistrarEnvioParams {
  cotacaoId: string;
  fornecedorId: string;
  acao: EnvioAcao;
  status?: EnvioStatus;
  origem?: EnvioOrigem;
  metadata?: Record<string, unknown>;
}

/**
 * Atomically updates cotacao_fornecedores.status_envio and inserts a
 * historico_envios row. Single source of truth on the DB side; the same
 * RPC will be called by a future webhook (Twilio) with origem='automatica'.
 */
export async function registrarEnvio({
  cotacaoId,
  fornecedorId,
  acao,
  status = ENVIO_STATUS.ENVIADO,
  origem = ENVIO_ORIGEM.MANUAL,
  metadata,
}: RegistrarEnvioParams) {
  const { data, error } = await supabase.rpc("registrar_envio_fornecedor" as never, {
    _cotacao_id: cotacaoId,
    _fornecedor_id: fornecedorId,
    _acao: acao,
    _status: status,
    _origem: origem,
    _metadata: (metadata ?? null) as never,
  } as never);
  if (error) throw error;
  return data as unknown as string;
}

export interface HistoricoEnvioRow {
  id: string;
  cotacao_id: string;
  fornecedor_id: string;
  acao: EnvioAcao;
  status: EnvioStatus;
  origem: EnvioOrigem;
  executado_por: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export async function fetchHistoricoEnvios(
  cotacaoId: string,
  fornecedorId: string,
): Promise<HistoricoEnvioRow[]> {
  const { data, error } = await supabase
    .from("historico_envios" as never)
    .select("*")
    .eq("cotacao_id", cotacaoId)
    .eq("fornecedor_id", fornecedorId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as HistoricoEnvioRow[];
}

export interface StatusEnvioRow {
  fornecedor_id: string;
  status_envio: EnvioStatus;
  enviado_em: string | null;
  ultima_atualizacao_status: string | null;
}

export async function fetchStatusEnviosCotacao(cotacaoId: string): Promise<StatusEnvioRow[]> {
  const { data, error } = await supabase
    .from("cotacao_fornecedores")
    .select("fornecedor_id, status_envio, enviado_em, ultima_atualizacao_status")
    .eq("cotacao_id", cotacaoId);
  if (error) throw error;
  return (data ?? []) as unknown as StatusEnvioRow[];
}
