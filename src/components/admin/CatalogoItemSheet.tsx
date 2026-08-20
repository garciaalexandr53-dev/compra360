import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertTriangle, Copy } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getFatorPadrao } from "@/lib/embalagemFatores";
import {
  CATALOGO_EMBALAGENS, CatalogoForm, soDigitos, validarCatalogoForm,
  palavrasChave, similaridadeNome,
} from "@/lib/catalogoAdmin";

export type CatalogoItem = {
  id: string;
  nome: string;
  ean: string | null;
  embalagem: string | null;
  fator_embalagem: number;
  ativo: boolean;
};

type Props = {
  /** null = fechado; { } sem id = novo item */
  item: CatalogoItem | "novo" | null;
  onClose: () => void;
  onSaved: () => void;
};

type Duplicata = { id: string; nome: string; ean: string | null; ativo: boolean; motivo: string };

const emptyForm: CatalogoForm = { nome: "", ean: "", embalagem: "UNI", fator_embalagem: 1, ativo: true };

export default function CatalogoItemSheet({ item, onClose, onSaved }: Props) {
  const isNovo = item === "novo";
  const [form, setForm] = useState<CatalogoForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [duplicatas, setDuplicatas] = useState<Duplicata[] | null>(null);

  useEffect(() => {
    setDuplicatas(null);
    if (!item) return;
    if (item === "novo") {
      setForm(emptyForm);
    } else {
      setForm({
        nome: item.nome ?? "",
        ean: item.ean ?? "",
        embalagem: (item.embalagem || "UNI").toUpperCase(),
        fator_embalagem: item.fator_embalagem || 1,
        ativo: item.ativo,
      });
    }
  }, [item]);

  const validacao = validarCatalogoForm(form);

  const buscarDuplicatas = async (): Promise<Duplicata[]> => {
    const encontradas: Duplicata[] = [];
    const currentId = isNovo ? null : (item as CatalogoItem).id;
    const ean = soDigitos(form.ean);

    if (ean) {
      let q = supabase.from("catalogo_mestre").select("id, nome, ean, ativo").eq("ean", ean).limit(5);
      if (currentId) q = q.neq("id", currentId);
      const { data } = await q;
      (data || []).forEach((d) => encontradas.push({ ...d, motivo: "Mesmo EAN" }));
    }

    if (isNovo) {
      const palavras = palavrasChave(form.nome);
      if (palavras.length) {
        const { data } = await supabase
          .from("catalogo_mestre")
          .select("id, nome, ean, ativo")
          .ilike("nome", `%${palavras.join("%")}%`)
          .limit(20);
        (data || [])
          .filter((d) => !encontradas.some((e) => e.id === d.id))
          .map((d) => ({ d, sim: similaridadeNome(d.nome, form.nome) }))
          .filter((x) => x.sim >= 0.5)
          .sort((a, b) => b.sim - a.sim)
          .slice(0, 5)
          .forEach((x) => encontradas.push({ ...x.d, motivo: "Nome semelhante" }));
      }
    }

    return encontradas.slice(0, 5);
  };

  const gravar = async () => {
    setSaving(true);
    const payload = {
      nome: form.nome.trim(),
      ean: soDigitos(form.ean) || null,
      embalagem: form.embalagem,
      fator_embalagem: Number(form.fator_embalagem),
      ativo: form.ativo,
    };
    const { error } = isNovo
      ? await supabase.from("catalogo_mestre").insert(payload)
      : await supabase.from("catalogo_mestre").update(payload).eq("id", (item as CatalogoItem).id);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: isNovo ? "Item criado" : "Item atualizado", description: payload.nome });
    onSaved();
    onClose();
  };

  const handleSalvar = async () => {
    if (!validacao.ok) {
      toast({ title: "Revise os campos", description: validacao.erros[0], variant: "destructive" });
      return;
    }
    if (duplicatas) {
      // Admin já viu os avisos de duplicata e confirmou
      await gravar();
      return;
    }
    setChecking(true);
    const dups = await buscarDuplicatas();
    setChecking(false);
    if (dups.length) {
      setDuplicatas(dups);
      return;
    }
    await gravar();
  };

  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle>{isNovo ? "Novo item do catálogo" : "Editar item"}</SheetTitle>
          <SheetDescription className="text-xs">
            Catálogo mestre compartilhado. Itens inativos não aparecem nas buscas dos clientes.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-5">
          <div className="space-y-1.5">
            <Label htmlFor="cat-nome">Nome</Label>
            <Input
              id="cat-nome"
              value={form.nome}
              maxLength={200}
              onChange={(e) => { setForm({ ...form, nome: e.target.value }); setDuplicatas(null); }}
              placeholder="Ex: Arroz Branco Tipo 1 5kg"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-ean">EAN (opcional)</Label>
            <Input
              id="cat-ean"
              value={form.ean}
              inputMode="numeric"
              maxLength={14}
              onChange={(e) => { setForm({ ...form, ean: soDigitos(e.target.value) }); setDuplicatas(null); }}
              placeholder="Somente dígitos"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Embalagem</Label>
              <Select
                value={form.embalagem}
                onValueChange={(v) => setForm({ ...form, embalagem: v, fator_embalagem: getFatorPadrao(v) })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATALOGO_EMBALAGENS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-fator">Fator</Label>
              <Input
                id="cat-fator"
                type="number"
                min={1}
                step={1}
                value={form.fator_embalagem}
                onChange={(e) => setForm({ ...form, fator_embalagem: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="cat-ativo" className="text-sm">Ativo</Label>
              <p className="text-[11px] text-muted-foreground">Visível nas buscas dos clientes</p>
            </div>
            <Switch id="cat-ativo" checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
          </div>

          {validacao.erros.length > 0 && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 space-y-1">
              {validacao.erros.map((e) => (
                <p key={e} className="text-xs text-destructive flex gap-1.5"><AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{e}</p>
              ))}
            </div>
          )}

          {validacao.avisos.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-1">
              {validacao.avisos.map((a) => (
                <p key={a} className="text-xs text-amber-700 dark:text-amber-400 flex gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{a}
                </p>
              ))}
            </div>
          )}

          {duplicatas && duplicatas.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex gap-1.5">
                <Copy className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                Possíveis duplicatas encontradas
              </p>
              <ul className="space-y-1.5">
                {duplicatas.map((d) => (
                  <li key={d.id} className="text-[11px] leading-tight">
                    <span className="font-medium break-words">{d.nome}</span>
                    <span className="text-muted-foreground"> — {d.motivo}{d.ean ? ` · ${d.ean}` : ""}{d.ativo ? "" : " · inativo"}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-muted-foreground">
                Clique em "Salvar mesmo assim" para confirmar a gravação.
              </p>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <Button variant="outline" className="sm:flex-1" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button className="sm:flex-1" onClick={handleSalvar} disabled={saving || checking || !validacao.ok}>
              {(saving || checking) && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {duplicatas ? "Salvar mesmo assim" : "Salvar"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
