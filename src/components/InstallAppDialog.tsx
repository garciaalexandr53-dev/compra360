import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Share, Plus, CheckCircle2, Chrome, Info } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** true = instruções do iPhone/iPad (Safari); false = instruções do Android/computador. */
  isIos: boolean;
};

const Passo = ({
  numero,
  titulo,
  children,
  icone: Icone,
}: {
  numero: number;
  titulo: string;
  children: React.ReactNode;
  icone: React.ElementType;
}) => (
  <div className="flex gap-3">
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
      {numero}
    </div>
    <div className="min-w-0 flex-1 pt-0.5">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Icone className="h-4 w-4 shrink-0 text-primary" />
        {titulo}
      </p>
      <p className="mt-0.5 text-sm text-muted-foreground">{children}</p>
    </div>
  </div>
);

export default function InstallAppDialog({ open, onOpenChange, isIos }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Instalar o Compra360</DialogTitle>
          <DialogDescription>
            {isIos
              ? "No iPhone e iPad a instalação é feita em 3 toques, pelo Safari."
              : "Siga os passos abaixo para colocar o Compra360 na sua tela."}
          </DialogDescription>
        </DialogHeader>

        {isIos ? (
          <div className="space-y-4">
            <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-xs text-foreground">
                Se você abriu este link pelo WhatsApp, toque nos três pontinhos no canto da tela e escolha{" "}
                <strong>Abrir no Safari</strong>. Só o Safari consegue instalar.
              </p>
            </div>

            <Passo numero={1} titulo="Toque em Compartilhar" icone={Share}>
              É o quadrado com a seta para cima, na barra de baixo do Safari.
            </Passo>
            <Passo numero={2} titulo="Adicionar à Tela de Início" icone={Plus}>
              Role a lista para baixo até encontrar essa opção e toque nela.
            </Passo>
            <Passo numero={3} titulo="Confirme em Adicionar" icone={CheckCircle2}>
              O ícone do Compra360 aparece na tela do seu celular, como um aplicativo.
            </Passo>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-xs text-foreground">
                Se você abriu este link pelo WhatsApp, toque nos três pontinhos no canto da tela e escolha{" "}
                <strong>Abrir no Chrome</strong>.
              </p>
            </div>

            <Passo numero={1} titulo="Abra o menu do navegador" icone={Chrome}>
              Toque nos três pontinhos no canto superior do Chrome.
            </Passo>
            <Passo numero={2} titulo="Instalar aplicativo" icone={Plus}>
              Escolha <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.
            </Passo>
            <Passo numero={3} titulo="Confirme em Instalar" icone={CheckCircle2}>
              O ícone do Compra360 aparece junto dos seus outros aplicativos.
            </Passo>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
