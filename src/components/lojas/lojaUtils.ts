export const formatCNPJ = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

export interface Loja {
  id: string;
  nome: string;
  nome_fantasia: string | null;
  endereco: string | null;
  cnpj: string | null;
  razao_social: string | null;
  inscricao_estadual: string | null;
  user_id: string | null;
  created_at: string;
}

export interface LojaForm {
  nome: string;
  nome_fantasia: string;
  endereco: string;
  cnpj: string;
  razao_social: string;
  inscricao_estadual: string;
}

export const emptyLojaForm: LojaForm = {
  nome: "",
  nome_fantasia: "",
  endereco: "",
  cnpj: "",
  razao_social: "",
  inscricao_estadual: "",
};

export interface LojaMetrics {
  produtosAtivos: number;
  fornecedoresVinculados: number;
  cotacoesMes: number;
  ultimaCotacaoAt: string | null;
  ultimaCotacaoId: string | null;
  cotacaoAtivaId: string | null;
}

/**
 * Determina se uma loja deve ser considerada "ativa" (selecionada).
 * Exposto para testes.
 */
export function isLojaAtiva(lojaId: string, ativaId: string | null | undefined): boolean {
  if (!ativaId) return false;
  return lojaId === ativaId;
}

/**
 * Retorna o nome de exibição preferindo nome_fantasia, com fallback para nome.
 */
export function getDisplayName(loja: Pick<Loja, "nome" | "nome_fantasia">): string {
  return (loja.nome_fantasia?.trim() || loja.nome || "").trim();
}
