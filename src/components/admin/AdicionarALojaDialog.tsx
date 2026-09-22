import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Search, Store, X, Check } from "lucide-react";
import { toast } from "sonner";
import { formatNomeEmpresa, formatNomeLoja } from "@/lib/masks";

export interface LojaCliente {
  loja_id: string;
  loja_nome: string;
  cidade: string | null;
  uf: string | null;
  user_id: string;
  cliente_nome: string | null;
  cliente_email: string | null;
  total_fornecedores: number;
}

export interface ResumoVinculo {
  criados: number;
  vinculados: number;
  ja_vinculados: number;
}

/** Frase de resultado da vinculação em lote, em pt-BR. */
export function resumoVinculoLabel(r: ResumoVinculo): string {
  const partes: string[] = [];
  const v = Number(r.vinculados ?? 0);
  const c = Number(r.criados ?? 0);
  const j = Number(r.ja_vinculados ?? 0);
  partes.push(`${v} ${v === 1 ? "fornecedor adicionado" : "fornecedores adicionados"} à loja`);
  if (c > 0) partes.push(`${c} ${c === 1 ? "novo cadastro criado" : "novos cadastros criados"}`);
  if (j > 0) partes.push(`${j} já ${j === 1 ? "estava" : "estavam"} na loja`);
  return partes.join(" · ");
}

/** Rótulo da loja com cliente e cidade. */
export function lojaLabel(l: LojaCliente): string {
  const cliente = l.cliente_nome ? formatNomeEmpresa(l.cliente_nome) : (l.cliente_email ?? "cliente sem nome");
  const local = l.cidade ? ` — ${formatNomeLoja(l.cidade)}${l.uf ? `/${l.uf.toUpperCase()}` : ""}` : "";
  return `${cliente} · ${formatNomeLoja(l.loja_nome)}${local}`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selecionados: { id: string; nome: string }[];
  onRemover: (id: string) => void;
  onConcluido: () => void;
}

export default function AdicionarALojaDialog({
  open, onOpenChange, selecionados, onRemover, onConcluido,
}: Props) {
  const [busca, setBusca] = useState("");
  const [debounced, setDebounced] = useState("");
  const [lojaId, setLojaId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(busca.trim()), 300);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    if (open) { setBusca(""); setDebounced(""); setLojaId(null); }
  }, [open]);

  const { data: lojas = [], isLoading } = useQuery({
    queryKey: ["admin-lojas-clientes", debounced],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_lojas_clientes", {
        _search: debounced || null,
      });
      if (error) throw error;
      return (data || []) as LojaCliente[];
    },
  });

  const lojaEscolhida = useMemo(() => lojas.find((l) => l.loja_id === lojaId) ?? null, [lojas, lojaId]);

  const vincular = useMutation({
    mutationFn: async () => {
      if (!lojaId) throw new Error("Escolha a loja de destino.");
      const { data, error } = await supabase.rpc("admin_vincular_fornecedores_loja", {
        _loja_id: lojaId,
        _fornecedor_ids: selecionados.map((s) => s.id),
      });
      if (error) throw error;
      return (data || {}) as unknown as ResumoVinculo;
    },
    onSuccess: (r) => {
      toast.success(resumoVinculoLabel(r));
      onOpenChange(false);
      onConcluido();
    },
    onError: (e: any) => toast.error(e?.message || "Não foi possível adicionar agora."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Store className="h-4 w-4 text-primary" />
            Adicionar a uma loja
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Os fornecedores passam a aparecer na loja escolhida. O cliente não recebe nenhum aviso.
        </p>

        {/* Selecionados */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium">
            {selecionados.length} {selecionados.length === 1 ? "fornecedor selecionado" : "fornecedores selecionados"}
          </p>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {selecionados.map((s) => (
              <Badge key={s.id} variant="secondary" className="text-[11px] gap-1 max-w-full">
                <span className="truncate">{formatNomeEmpresa(s.nome)}</span>
                <button type="button" onClick={() => onRemover(s.id)} aria-label={`Remover ${s.nome}`}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        {/* Busca do cliente/loja */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente, loja, cidade ou e-mail"
            className="pl-8 h-9 text-sm"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-[120px]">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : lojas.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Nenhuma loja encontrada.</p>
          ) : (
            lojas.map((l) => {
              const ativo = l.loja_id === lojaId;
              return (
                <button
                  key={l.loja_id}
                  type="button"
                  onClick={() => setLojaId(l.loja_id)}
                  className={`w-full text-left rounded-lg border p-2.5 transition-colors ${
                    ativo ? "border-primary/60 bg-primary/5" : "hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight break-words">
                        {formatNomeLoja(l.loja_nome)}
                        {l.cidade ? (
                          <span className="text-xs font-normal text-muted-foreground">
                            {" "}· {formatNomeLoja(l.cidade)}{l.uf ? `/${l.uf.toUpperCase()}` : ""}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-[11px] text-muted-foreground break-words">
                        {l.cliente_nome ? formatNomeEmpresa(l.cliente_nome) : l.cliente_email}
                        {" · "}{Number(l.total_fornecedores)} {Number(l.total_fornecedores) === 1 ? "fornecedor" : "fornecedores"}
                      </p>
                    </div>
                    {ativo && <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button
            onClick={() => vincular.mutate()}
            disabled={!lojaId || selecionados.length === 0 || vincular.isPending}
            className="w-full sm:w-auto"
          >
            {vincular.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar e vincular
            {lojaEscolhida ? "" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
