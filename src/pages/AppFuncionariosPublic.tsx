import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Toaster as Sonner } from "@/components/ui/sonner";

const AppFuncionariosPublic = () => {
  const [items, setItems] = useState<string[]>([]);
  const [current, setCurrent] = useState("");
  const [nome, setNome] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const addItem = () => {
    const trimmed = current.trim();
    if (!trimmed) return;
    setItems([...items, trimmed]);
    setCurrent("");
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addItem();
    }
  };

  const enviar = async () => {
    if (!items.length) {
      toast.error("Adicione pelo menos um item!");
      return;
    }
    setSending(true);
    try {
      const inserts = items.map((item) => ({
        nome: item,
        registrado_por: nome.trim() || "Funcionário",
      }));
      const { error } = await supabase.from("itens_faltantes").insert(inserts);
      if (error) throw error;
      setSent(true);
      toast.success("Lista enviada!");
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
    setSending(false);
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Sonner />
        <div className="text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-bold mb-2">Lista Enviada!</h1>
          <p className="text-muted-foreground mb-4">
            {items.length} item(ns) registrado(s). O comprador irá revisar.
          </p>
          <Button
            onClick={() => {
              setItems([]);
              setSent(false);
            }}
            className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))]"
          >
            Enviar outra lista
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <Sonner />
      {/* Header */}
      <div className="bg-gradient-to-r from-[hsl(var(--brand-dark))] via-[hsl(var(--brand))] to-[hsl(var(--brand-light))] text-white p-5 sticky top-0 z-10 shadow-lg">
        <h1 className="text-lg font-bold">📋 Lista de Itens Faltando</h1>
        <p className="text-sm opacity-80">Digite os itens que estão em falta</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Name input */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
            Seu nome (opcional)
          </label>
          <Input
            placeholder="Ex: João"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </div>

        {/* Add item */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">
            Item faltando
          </label>
          <div className="flex gap-2">
            <Input
              placeholder="Ex: Detergente Ype 500ml"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1"
            />
            <Button
              onClick={addItem}
              disabled={!current.trim()}
              className="bg-gradient-to-r from-[hsl(var(--brand-light))] to-[hsl(var(--brand))] px-6"
            >
              +
            </Button>
          </div>
        </div>

        {/* Items list */}
        {items.length > 0 && (
          <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 border-b bg-muted">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {items.length} item(ns) na lista
              </span>
            </div>
            {items.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0"
              >
                <span className="text-xs text-muted-foreground">{i + 1}.</span>
                <span className="flex-1 text-sm font-medium">{item}</span>
                <button
                  onClick={() => removeItem(i)}
                  className="text-destructive text-sm hover:bg-destructive/10 rounded-full w-7 h-7 flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t p-4 shadow-lg">
        <Button
          onClick={enviar}
          disabled={sending || items.length === 0}
          className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-base py-6 font-bold"
        >
          {sending ? "Enviando..." : `📤 Enviar ${items.length} Item(ns)`}
        </Button>
      </div>
    </div>
  );
};

export default AppFuncionariosPublic;
