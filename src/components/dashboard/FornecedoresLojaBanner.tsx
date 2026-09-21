import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { Button } from "@/components/ui/button";
import { MapPin, UserPlus } from "lucide-react";
import { formatNomeLoja } from "@/lib/masks";
import SugestoesRegiaoDialog, { type SugestaoFornecedor } from "@/components/fornecedores/SugestoesRegiaoDialog";

/**
 * Aviso no painel para lojas que ainda não têm fornecedores cadastrados.
 * - Se existem fornecedores na mesma cidade (rede), oferece importar com 1 clique.
 * - Caso contrário, convida a cadastrar os próprios fornecedores.
 */
export default function FornecedoresLojaBanner() {
  const { lojaAtiva, lojas } = useLojaAtiva();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const loja = lojaAtiva as
    | { id: string; nome?: string | null; nome_fantasia?: string | null; cidade?: string | null; uf?: string | null }
    | null
    | undefined;

  // Conta fornecedores disponíveis para a loja ativa: vinculados a ela
  // OU sem nenhum vínculo (nesse caso atendem todas as lojas).
  // Quando a conta tem apenas uma loja, qualquer fornecedor cadastrado atende essa loja.
  const lojaUnica = (lojas?.length ?? 0) <= 1;

  const { data: totalFornecedores } = useQuery({
    queryKey: ["fornecedores-count", loja?.id, lojaUnica],
    enabled: !!loja?.id,
    refetchOnMount: "always",
    queryFn: async () => {
      const [{ data: fornecedores, error: errF }, { data: vinculos, error: errV }] = await Promise.all([
        supabase.from("fornecedores").select("id"),
        supabase.from("fornecedor_lojas").select("fornecedor_id, loja_id"),
      ]);
      if (errF) throw errF;
      if (errV) throw errV;
      if (lojaUnica) return (fornecedores || []).length;
      const vinculados = new Set((vinculos || []).map((v) => v.fornecedor_id));
      const daLoja = new Set((vinculos || []).filter((v) => v.loja_id === loja!.id).map((v) => v.fornecedor_id));
      return (fornecedores || []).filter((f) => daLoja.has(f.id) || !vinculados.has(f.id)).length;
    },
  });


  const { data: sugestoes = [] } = useQuery({
    queryKey: ["sugestoes-regiao", loja?.id],
    enabled: !!loja?.id && !!loja?.cidade,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("sugerir_fornecedores_por_cidade", { _loja_id: loja!.id });
      if (error) throw error;
      return (data || []) as SugestaoFornecedor[];
    },
  });

  // Loja sem cidade: o aviso de cidade tem prioridade.
  if (!loja?.id || !loja.cidade?.trim()) return null;
  // Já tem fornecedores cadastrados: nada a avisar.
  if (totalFornecedores === undefined || totalFornecedores > 0) return null;

  const cidadeLabel = `${formatNomeLoja(loja.cidade)}${loja.uf ? ` - ${loja.uf.toUpperCase()}` : ""}`;
  const temSugestoes = sugestoes.length > 0;

  return (
    <>
      <div className="mb-4 rounded-xl border border-primary/40 bg-primary/5 p-3 flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          {temSugestoes ? <MapPin className="h-4 w-4 text-primary" /> : <UserPlus className="h-4 w-4 text-primary" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {temSugestoes ? "Sua loja ainda não tem fornecedores" : "Cadastre seus primeiros fornecedores"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {temSugestoes
              ? `Encontramos ${sugestoes.length} fornecedor${sugestoes.length === 1 ? "" : "es"} que já atende${sugestoes.length === 1 ? "" : "m"} em ${cidadeLabel}. Adicione com 1 clique e agilize suas cotações.`
              : "Adicione seus contatos para começar a enviar cotações e comparar preços."}
          </p>
          <Button
            size="sm"
            className="mt-2"
            onClick={() => (temSugestoes ? setOpen(true) : navigate("/fornecedores"))}
          >
            {temSugestoes ? "Ver fornecedores da região" : "Cadastrar fornecedores"}
          </Button>
        </div>
      </div>

      <SugestoesRegiaoDialog
        open={open}
        onOpenChange={setOpen}
        sugestoes={sugestoes}
        lojaId={loja.id}
        cidadeLabel={cidadeLabel}
        onAdded={() => {
          qc.invalidateQueries({ queryKey: ["fornecedores"] });
          qc.invalidateQueries({ queryKey: ["fornecedores-count"] });
          qc.invalidateQueries({ queryKey: ["fornecedor-lojas"] });
          qc.invalidateQueries({ queryKey: ["sugestoes-regiao"] });
        }}
      />
    </>
  );
}
