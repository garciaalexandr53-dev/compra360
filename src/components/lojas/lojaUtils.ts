export const formatCNPJ = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

export const formatCEP = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.replace(/^(\d{5})(\d)/, "$1-$2");
};

export const formatUF = (value: string) =>
  value.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();

export interface Loja {
  id: string;
  nome: string;
  nome_fantasia: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
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
  cidade: string;
  uf: string;
  cep: string;
  cnpj: string;
  razao_social: string;
  inscricao_estadual: string;
}

export const emptyLojaForm: LojaForm = {
  nome: "",
  nome_fantasia: "",
  endereco: "",
  cidade: "",
  uf: "",
  cep: "",
  cnpj: "",
  razao_social: "",
  inscricao_estadual: "",
};

/**
 * "Cidade - UF" quando houver ambos; apenas o que existir caso contrário.
 */
export function formatCidadeUF(loja: Pick<Loja, "cidade" | "uf">): string {
  return [loja.cidade?.trim(), loja.uf?.trim()].filter(Boolean).join(" - ");
}

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
