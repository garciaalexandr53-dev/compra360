import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { LojaForm, formatCNPJ } from "./lojaUtils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  form: LojaForm;
  setForm: (f: LojaForm) => void;
  onSave: () => void;
  saving?: boolean;
}

export default function LojaEditModal({ open, onOpenChange, editing, form, setForm, onSave, saving }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Loja" : "Nova Loja"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome Fantasia *</Label>
            <Input
              value={form.nome_fantasia}
              onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })}
              placeholder="Ex: Mercado Central"
            />
          </div>
          <div>
            <Label>Apelido / Identificador interno</Label>
            <Input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: Loja Centro"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Usado internamente quando o nome fantasia for muito longo.
            </p>
          </div>
          <div>
            <Label>Razão Social</Label>
            <Input
              value={form.razao_social}
              onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
              placeholder="Ex: Empresa LTDA"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>CNPJ</Label>
              <Input
                value={form.cnpj}
                onChange={(e) => setForm({ ...form, cnpj: formatCNPJ(e.target.value) })}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div>
              <Label>Inscrição Estadual</Label>
              <Input
                value={form.inscricao_estadual}
                onChange={(e) => setForm({ ...form, inscricao_estadual: e.target.value })}
                placeholder="Opcional"
              />
            </div>
          </div>
          <div>
            <Label>Endereço</Label>
            <Input
              value={form.endereco}
              onChange={(e) => setForm({ ...form, endereco: e.target.value })}
              placeholder="Ex: Rua Principal, 100"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={onSave}
            disabled={saving || (!form.nome_fantasia.trim() && !form.nome.trim())}
          >
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
