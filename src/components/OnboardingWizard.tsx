import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Store, Truck, Package, Sparkles, ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface OnboardingWizardProps {
  open: boolean;
  onClose: () => void;
}

export default function OnboardingWizard({ open, onClose }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  // Step 1 - Loja
  const [lojaNome, setLojaNome] = useState("");

  // Step 2 - Fornecedor
  const [fornNome, setFornNome] = useState("");
  const [fornRepresentante, setFornRepresentante] = useState("");
  const [fornTelefone, setFornTelefone] = useState("");
  const [fornEmail, setFornEmail] = useState("");

  // Step 3 - Produto
  const [prodNome, setProdNome] = useState("");
  const [prodEmbalagem, setProdEmbalagem] = useState("");

  const totalSteps = 4;
  const progress = ((step + 1) / totalSteps) * 100;

  const saveStep = async () => {
    setSaving(true);
    try {
      if (step === 1) {
        if (!lojaNome.trim()) return;
        const { error } = await supabase.from("lojas").insert({ nome: lojaNome.trim() });
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ["lojas"] });
      } else if (step === 2) {
        if (!fornNome.trim()) return;
        const { error } = await supabase.from("fornecedores").insert({
          nome: fornNome.trim(),
          representante: fornRepresentante.trim() || null,
          telefone: fornTelefone.trim() || null,
          email: fornEmail.trim() || null,
        });
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ["fornecedores"] });
      } else if (step === 3) {
        if (!prodNome.trim()) return;
        const { error } = await supabase.from("produtos").insert({
          nome: prodNome.trim(),
          embalagem: prodEmbalagem.trim() || null,
        });
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ["produtos"] });
      }
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
      return;
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    if (step > 0) {
      await saveStep();
    }
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      toast({ title: "🎉 Bem-vindo ao Compra360!", description: "Seu ambiente está pronto. Boas compras!" });
      onClose();
      navigate("/cotacao");
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const canAdvance = () => {
    if (step === 0) return true;
    if (step === 1) return lojaNome.trim().length > 0;
    if (step === 2) return fornNome.trim().length > 0;
    if (step === 3) return prodNome.trim().length > 0;
    return true;
  };

  const stepIcons = [Sparkles, Store, Truck, Package];
  const stepLabels = ["Boas-vindas", "Loja", "Fornecedor", "Produto"];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg">
              Etapa {step + 1} de {totalSteps} — {stepLabels[step]}
            </DialogTitle>
          </div>
          <DialogDescription className="sr-only">Wizard de configuração inicial</DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex gap-1">
            {stepLabels.map((label, i) => {
              const Icon = stepIcons[i];
              return (
                <div
                  key={label}
                  className={`flex-1 flex flex-col items-center gap-1 text-xs ${
                    i <= step ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </div>
              );
            })}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step content */}
        <div className="py-4 space-y-4">
          {step === 0 && (
            <div className="space-y-3 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Bem-vindo ao Compra360!</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Vamos configurar seu ambiente em poucos passos. Você vai cadastrar sua <strong>loja</strong>, seu primeiro <strong>fornecedor</strong> e seu primeiro <strong>produto</strong>. Depois disso, estará pronto para criar cotações e economizar nas compras!
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Store className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loja-nome">Nome da Loja *</Label>
                <Input
                  id="loja-nome"
                  placeholder="Ex: Mercado Central"
                  value={lojaNome}
                  onChange={(e) => setLojaNome(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Truck className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="forn-nome">Nome do Fornecedor *</Label>
                <Input
                  id="forn-nome"
                  placeholder="Ex: Distribuidora ABC"
                  value={fornNome}
                  onChange={(e) => setFornNome(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="forn-rep">Representante</Label>
                <Input
                  id="forn-rep"
                  placeholder="Nome do representante"
                  value={fornRepresentante}
                  onChange={(e) => setFornRepresentante(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="forn-tel">Telefone</Label>
                  <Input
                    id="forn-tel"
                    placeholder="(00) 00000-0000"
                    value={fornTelefone}
                    onChange={(e) => setFornTelefone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="forn-email">E-mail</Label>
                  <Input
                    id="forn-email"
                    type="email"
                    placeholder="email@exemplo.com"
                    value={fornEmail}
                    onChange={(e) => setFornEmail(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prod-nome">Nome do Produto *</Label>
                <Input
                  id="prod-nome"
                  placeholder="Ex: Arroz 5kg"
                  value={prodNome}
                  onChange={(e) => setProdNome(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prod-emb">Embalagem / Unidade</Label>
                <Input
                  id="prod-emb"
                  placeholder="Ex: Pacote 5kg, Caixa 12un"
                  value={prodEmbalagem}
                  onChange={(e) => setProdEmbalagem(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground">
            <X className="h-4 w-4 mr-1" />
            Pular por agora
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={handleBack} disabled={saving}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Voltar
              </Button>
            )}
            <Button size="sm" onClick={handleNext} disabled={!canAdvance() || saving}>
              {step === totalSteps - 1 ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Concluir
                </>
              ) : (
                <>
                  Avançar
                  <ArrowRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
