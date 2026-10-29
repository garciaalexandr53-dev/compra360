import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Check, ClipboardList, MessageCircle, PencilLine, BarChart3, Send } from "lucide-react";

/**
 * Demonstração ilustrativa do caminho de uma cotação.
 * Só exemplos fictícios na tela: não grava nada e não envia mensagens.
 */
const CENAS = [
  {
    icon: ClipboardList,
    titulo: "1. Sua equipe monta a lista",
    texto: "No App Funcionários, o repositor anota o que está faltando direto do corredor.",
    exemplo: ["Arroz Tipo 1 5kg — 20 fardos", "Óleo de Soja 900ml — 15 caixas", "Café 500g — 12 caixas"],
  },
  {
    icon: MessageCircle,
    titulo: "2. Você envia pelo WhatsApp",
    texto: "Cada fornecedor recebe um link com a lista e o horário de fechamento.",
    exemplo: ["Distribuidora Exemplo ✓ enviado", "Atacado Modelo ✓ enviado", "Comercial Demo ✓ enviado"],
  },
  {
    icon: PencilLine,
    titulo: "3. Fornecedores preenchem os preços",
    texto: "Eles abrem o link no celular e digitam os preços, sem precisar de cadastro.",
    exemplo: ["Arroz 5kg — R$ 24,90 / R$ 23,70 / R$ 25,10"],
  },
  {
    icon: BarChart3,
    titulo: "4. O sistema compara sozinho",
    texto: "O menor preço de cada item é marcado automaticamente.",
    exemplo: ["Arroz → Atacado Modelo (R$ 23,70)", "Óleo → Distribuidora Exemplo", "Café → Comercial Demo"],
  },
  {
    icon: Send,
    titulo: "5. Pedidos prontos para enviar",
    texto: "Um pedido para cada fornecedor vencedor, enviado pelo WhatsApp com um toque.",
    exemplo: ["3 pedidos gerados", "Economia estimada: R$ 186,00"],
  },
];

export default function CotacaoDemo({ onConcluir }: { onConcluir?: () => void } = {}) {
  const [i, setI] = useState(0);
  const cena = CENAS[i];
  const Icon = cena.icon;
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-left space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-primary">Como funciona uma cotação</span>
        <span className="text-[11px] text-muted-foreground">Exemplo ilustrativo</span>
      </div>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{cena.titulo}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{cena.texto}</p>
        </div>
      </div>
      <ul className="rounded-md bg-background border p-2 space-y-1">
        {cena.exemplo.map((l) => (
          <li key={l} className="text-xs text-foreground">{l}</li>
        ))}
      </ul>
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="sm" disabled={i === 0} onClick={() => setI(i - 1)} aria-label="Cena anterior">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex gap-1">
          {CENAS.map((_, k) => (
            <span key={k} className={`h-1.5 w-4 rounded-full ${k === i ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
        {i === CENAS.length - 1 && onConcluir ? (
          <Button type="button" size="sm" onClick={onConcluir} className="h-8">
            <Check className="h-4 w-4 mr-1" /> Começar a usar
          </Button>
        ) : (
          <Button type="button" variant="ghost" size="sm" disabled={i === CENAS.length - 1} onClick={() => setI(i + 1)} aria-label="Próxima cena">
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
