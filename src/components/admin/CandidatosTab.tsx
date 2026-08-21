import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, X, PackagePlus, Barcode } from "lucide-react";
import CatalogoItemSheet, { CatalogoSheetTarget } from "./CatalogoItemSheet";
import { Candidato, CandidatoRow, filtrarCandidatos, mapCandidatos } from "@/lib/catalogoCandidatos";
import { formatDate } from "@/lib/format";

export default function CandidatosTab() {
  const qc = useQueryClient();
  const [termo, setTermo] = useState("");
  const [sheet, setSheet] = useState<CatalogoSheetTarget>(null);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-candidatos-catalogo"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_candidatos_catalogo");
      if (error) throw error;
      return mapCandidatos((data || []) as unknown as CandidatoRow[]);
    },
  });

  const candidatos = useMemo(() => filtrarCandidatos(data || [], termo), [data, termo]);
  const total = data?.length || 0;

  const abrirCadastro = (c: Candidato) =>
    setSheet({
      modo: "novo",
      inicial: { nome: c.nome, ean: c.ean, embalagem: c.embalagem, fator_embalagem: c.fator_embalagem, ativo: true },
    });

  const contador = isLoading
    ? "Carregando…"
    : `${candidatos.length.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")} ${total === 1 ? "candidato" : "candidatos"}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Buscar por nome ou EAN"
            className="pl-8 pr-8"
          />
          {termo && (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => setTermo("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <span className="text-xs text-muted-foreground flex items-center gap-1.5 sm:ml-auto">
          {isFetching && <Loader2 className="h-3 w-3 animate-spin" />}
          {contador}
        </span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : candidatos.length === 0 ? (
        <Card>
          <CardContent className="py-10 px-4 text-center space-y-2">
            <Barcode className="h-6 w-6 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {termo
                ? `Nenhum candidato encontrado para "${termo}".`
                : "Nenhum candidato no momento. Produtos com código de barras cadastrados pelos clientes que ainda não existem no catálogo mestre aparecerão aqui."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Nome informado</th>
                  <th className="text-left px-3 py-2 font-medium w-[140px]">EAN</th>
                  <th className="text-left px-3 py-2 font-medium w-[110px]">Embalagem</th>
                  <th className="text-left px-3 py-2 font-medium w-[200px]">Origem</th>
                  <th className="text-right px-3 py-2 font-medium w-[90px]">Ocorrências</th>
                  <th className="text-left px-3 py-2 font-medium w-[110px]">Último</th>
                  <th className="w-[150px]" />
                </tr>
              </thead>
              <tbody>
                {candidatos.map((c) => (
                  <tr key={c.ean} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2">{c.nome || "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{c.ean}</td>
                    <td className="px-3 py-2">{c.embalagem} ({c.fator_embalagem})</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {c.origens.map((o) => (
                          <Badge key={o} variant="secondary" className="text-[10px] py-0">{o}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">{c.ocorrencias}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {c.ultimo_em ? formatDate(c.ultimo_em) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button size="sm" variant="outline" className="h-8" onClick={() => abrirCadastro(c)}>
                        <PackagePlus className="h-4 w-4 mr-1.5" />
                        Cadastrar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-2">
            {candidatos.map((c) => (
              <Card key={c.ean}>
                <CardContent className="p-3 space-y-2">
                  <p className="text-sm font-medium leading-tight break-words">{c.nome || "—"}</p>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="font-mono break-all">{c.ean}</span>
                    <span>·</span>
                    <span>{c.embalagem} ({c.fator_embalagem})</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {c.origens.map((o) => (
                      <Badge key={o} variant="secondary" className="text-[10px] py-0">{o}</Badge>
                    ))}
                    <Badge variant="outline" className="text-[10px] py-0">
                      {c.ocorrencias}x
                    </Badge>
                  </div>
                  <Button size="sm" className="w-full" onClick={() => abrirCadastro(c)}>
                    <PackagePlus className="h-4 w-4 mr-1.5" />
                    Cadastrar no catálogo
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <CatalogoItemSheet
        item={sheet}
        onClose={() => setSheet(null)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["admin-candidatos-catalogo"] });
          qc.invalidateQueries({ queryKey: ["admin-catalogo"] });
        }}
      />
    </div>
  );
}
