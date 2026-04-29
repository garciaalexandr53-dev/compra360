import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2 } from "lucide-react";

export interface ProdutoSheetItem {
  id: string;
  nome: string;
  embalagem?: string | null;
  fator_embalagem?: number | null;
  categorias?: { nome: string } | null;
}

interface Props {
  produto: ProdutoSheetItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (produto: ProdutoSheetItem) => void;
  onDelete: (produto: ProdutoSheetItem) => void;
}

export default function ProdutoSheet({ produto, open, onOpenChange, onEdit, onDelete }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!produto) return null;

  const categoria = produto.categorias?.nome || "Sem Categoria";
  const embalagem = produto.embalagem || "un";
  const fator = produto.fator_embalagem || 1;

  const handleEdit = () => {
    onOpenChange(false);
    onEdit(produto);
  };

  const handleConfirmDelete = () => {
    setConfirmOpen(false);
    onOpenChange(false);
    onDelete(produto);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="h-auto sm:max-w-md sm:mx-auto sm:rounded-t-2xl p-0"
        >
          <SheetHeader className="px-5 pt-5 pb-3 pr-14 text-left border-b">
            <SheetTitle className="text-xl font-bold leading-tight break-words">
              {produto.nome}
            </SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground">
              {categoria} · {embalagem} · Fator {fator}
            </SheetDescription>
          </SheetHeader>

          <div className="px-5 py-5 space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-2 h-12"
              onClick={handleEdit}
            >
              <Pencil className="h-4 w-4" />
              Editar produto
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-2 h-12 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              Excluir produto
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDelete}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
