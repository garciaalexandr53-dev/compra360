import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Store, Truck, Package, Sparkles, ArrowLeft, ArrowRight, Check, X, Plus, Trash2, PartyPopper, Download } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getDeviceFingerprint } from "@/lib/fingerprint";
import CatalogoBaseModal from "@/components/CatalogoBaseModal";

interface OnboardingWizardProps {
  open: boolean;
  onClose: () => void;
}

const formatCNPJ = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

interface FornecedorDraft {
  id: string;
  nome: string;
  representante: string;
  telefone: string;
  email: string;
  pedido_minimo: string;
  prazo_pagamento: string;
  observacoes: string;
}

interface ProdutoDraft {
  id: string;
  nome: string;
  embalagem: string;
}

const emptyFornecedor = (): FornecedorDraft => ({
  id: crypto.randomUUID(),
  nome: "",
  representante: "",
  telefone: "",
  email: "",
  pedido_minimo: "",
  prazo_pagamento: "",
  observacoes: "",
});

const emptyProduto = (): ProdutoDraft => ({
  id: crypto.randomUUID(),
  nome: "",
  embalagem: "",
});

export default function OnboardingWizard({ open, onClose }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  // Step 1 - Loja
  const [lojaNome, setLojaNome] = useState("");
  const [lojaCnpj, setLojaCnpj] = useState("");

  // Step 2 - Fornecedores (múltiplos)
  const [fornecedores, setFornecedores] = useState<FornecedorDraft[]>([emptyFornecedor()]);

  // Step 3 - Produtos (múltiplos)
  const [produtos, setProdutos] = useState<ProdutoDraft[]>([emptyProduto()]);

  // Tracking saved state
  const [lojaSaved, setLojaSaved] = useState(false);
  const [fornSavedCount, setFornSavedCount] = useState(0);
  const [prodSavedCount, setProdSavedCount] = useState(0);

  // Fingerprint
  const [fingerprint, setFingerprint] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      getDeviceFingerprint().then(setFingerprint);
    }
  }, [open]);

  const totalSteps = 5; // Boas-vindas, Loja, Fornecedores, Produtos, Conclusão
  const progress = ((step + 1) / totalSteps) * 100;

  // --- Fornecedor helpers ---
  const updateFornecedor = (id: string, field: keyof FornecedorDraft, value: string) => {
    setFornecedores((prev) => prev.map((f) => (f.id === id ? { ...f, [field]: value } : f)));
  };
  const addFornecedor = () => setFornecedores((prev) => [...prev, emptyFornecedor()]);
  const removeFornecedor = (id: string) => {
    if (fornecedores.length <= 1) return;
    setFornecedores((prev) => prev.filter((f) => f.id !== id));
  };

  // --- Produto helpers ---
  const updateProduto = (id: string, field: keyof ProdutoDraft, value: string) => {
    setProdutos((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };
  const addProduto = () => setProdutos((prev) => [...prev, emptyProduto()]);
  const removeProduto = (id: string) => {
    if (produtos.length <= 1) return;
    setProdutos((prev) => prev.filter((p) => p.id !== id));
  };

  const saveStep = async () => {
    setSaving(true);
    try {
      if (step === 1) {
        if (!lojaNome.trim()) return;
        const cnpjDigits = lojaCnpj.replace(/\D/g, "");

        // Check trial eligibility
        if (cnpjDigits.length === 14 || fingerprint) {
          const { data: eligibility } = await supabase.rpc("check_trial_eligibility", {
            _cnpj: cnpjDigits.length === 14 ? cnpjDigits : null,
            _fingerprint: fingerprint,
            _phone: null,
          });
          if (eligibility && !(eligibility as any).eligible) {
            const reason = (eligibility as any).blocked_by;
            const msgs: Record<string, string> = {
              cnpj: "Este CNPJ já utilizou o período de teste gratuito.",
              fingerprint: "Este dispositivo já utilizou o período de teste gratuito.",
            };
            toast({
              title: "Trial não disponível",
              description: msgs[reason] || "Você já utilizou o período de teste. Sua conta será criada no plano Grátis.",
              variant: "destructive",
            });
          }
        }

        const { error } = await supabase.from("lojas").insert({
          nome: lojaNome.trim(),
          cnpj: cnpjDigits.length === 14 ? cnpjDigits : null,
          user_id: user?.id,
        });
        if (error) throw error;

        if (fingerprint && user?.id) {
          await supabase.from("trial_controls" as any).upsert({
            user_id: user.id,
            device_fingerprint: fingerprint,
          }, { onConflict: "user_id" });
        }

        setLojaSaved(true);
        qc.invalidateQueries({ queryKey: ["lojas"] });
        qc.invalidateQueries({ queryKey: ["user-plan"] });
      } else if (step === 2) {
        const validForn = fornecedores.filter((f) => f.nome.trim());
        if (validForn.length === 0) return;

        const inserts = validForn.map((f) => ({
          nome: f.nome.trim(),
          representante: f.representante.trim() || null,
          telefone: f.telefone.trim() || null,
          email: f.email.trim() || null,
          pedido_minimo: f.pedido_minimo ? parseFloat(f.pedido_minimo.replace(",", ".")) : null,
          prazo_pagamento: f.prazo_pagamento.trim() || null,
          observacoes: f.observacoes.trim() || null,
          user_id: user?.id,
        }));

        const { error } = await supabase.from("fornecedores").insert(inserts);
        if (error) throw error;
        setFornSavedCount(validForn.length);
        qc.invalidateQueries({ queryKey: ["fornecedores"] });
      } else if (step === 3) {
        const validProd = produtos.filter((p) => p.nome.trim());
        if (validProd.length === 0) return;

        const inserts = validProd.map((p) => ({
          nome: p.nome.trim(),
          embalagem: p.embalagem.trim() || null,
          user_id: user?.id,
        }));

        const { error } = await supabase.from("produtos").insert(inserts);
        if (error) throw error;
        setProdSavedCount(validProd.length);
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
    if (step >= 1 && step <= 3) {
      await saveStep();
    }
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      // Conclusão → marcar como concluído
      localStorage.setItem("onboarding_completed", "true");
      toast({ title: "🎉 Bem-vindo ao Compra360!", description: "Seu ambiente está pronto. Boas compras!" });
      onClose();
      navigate("/dashboard");
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSkip = () => {
    localStorage.setItem("onboarding_completed", "true");
    onClose();
  };

  const canAdvance = () => {
    if (step === 0) return true;
    if (step === 1) return lojaNome.trim().length > 0;
    if (step === 2) return fornecedores.some((f) => f.nome.trim().length > 0);
    if (step === 3) return produtos.some((p) => p.nome.trim().length > 0);
    return true; // conclusão
  };

  const stepIcons = [Sparkles, Store, Truck, Package, PartyPopper];
  const stepLabels = ["Início", "Loja", "Fornecedores", "Produtos", "Pronto!"];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleSkip()}>
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
                  <span className="hidden sm:inline truncate">{label}</span>
                </div>
              );
            })}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step content */}
        <div className="py-2 space-y-4">
          {/* === STEP 0: Boas-vindas === */}
          {step === 0 && (
            <div className="space-y-3 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Bem-vindo ao Compra360!</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Vamos configurar seu ambiente em poucos passos para deixar tudo pronto para uso:
              </p>
              <div className="text-left space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <Store className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span><strong>Loja</strong> — cadastre sua unidade com CNPJ</span>
                </div>
                <div className="flex items-start gap-2">
                  <Truck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span><strong>Fornecedores</strong> — adicione seus parceiros com dados de contato, pedido mínimo e prazo</span>
                </div>
                <div className="flex items-start gap-2">
                  <Package className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span><strong>Produtos</strong> — cadastre os itens que você compra regularmente</span>
                </div>
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm text-left">
                <p className="font-medium text-primary">🎁 30 dias grátis no plano Business!</p>
                <p className="text-muted-foreground mt-1">Aproveite todas as funcionalidades premium durante o período de teste.</p>
              </div>
            </div>
          )}

          {/* === STEP 1: Loja === */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Store className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Cadastre a unidade principal da sua empresa.
              </p>
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
              <div className="space-y-2">
                <Label htmlFor="loja-cnpj">CNPJ *</Label>
                <Input
                  id="loja-cnpj"
                  placeholder="00.000.000/0000-00"
                  value={lojaCnpj}
                  onChange={(e) => setLojaCnpj(formatCNPJ(e.target.value))}
                  maxLength={18}
                />
                <p className="text-xs text-muted-foreground">Necessário para ativar o período de teste gratuito</p>
              </div>
            </div>
          )}

          {/* === STEP 2: Fornecedores (múltiplos) === */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Truck className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Cadastre seus fornecedores com as informações de contato. Você pode adicionar quantos quiser.
              </p>

              {fornecedores.map((f, idx) => (
                <div key={f.id} className="border rounded-lg p-3 space-y-3 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Fornecedor {idx + 1}</span>
                    {fornecedores.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeFornecedor(f.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input
                      placeholder="Ex: Distribuidora ABC"
                      value={f.nome}
                      onChange={(e) => updateFornecedor(f.id, "nome", e.target.value)}
                      autoFocus={idx === 0}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Representante</Label>
                      <Input
                        placeholder="Nome"
                        value={f.representante}
                        onChange={(e) => updateFornecedor(f.id, "representante", e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">WhatsApp / Telefone</Label>
                      <Input
                        placeholder="(00) 00000-0000"
                        value={f.telefone}
                        onChange={(e) => updateFornecedor(f.id, "telefone", e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">E-mail</Label>
                      <Input
                        type="email"
                        placeholder="email@exemplo.com"
                        value={f.email}
                        onChange={(e) => updateFornecedor(f.id, "email", e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Pedido Mínimo (R$)</Label>
                      <Input
                        placeholder="0,00"
                        value={f.pedido_minimo}
                        onChange={(e) => updateFornecedor(f.id, "pedido_minimo", e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Prazo de pagamento / Dia de entrega</Label>
                    <Input
                      placeholder="Ex: 28 dias, entrega às terças"
                      value={f.prazo_pagamento}
                      onChange={(e) => updateFornecedor(f.id, "prazo_pagamento", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Observações</Label>
                    <Input
                      placeholder="Ex: Só entrega acima de R$500"
                      value={f.observacoes}
                      onChange={(e) => updateFornecedor(f.id, "observacoes", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              ))}

              <Button variant="outline" size="sm" className="w-full" onClick={addFornecedor}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar outro fornecedor
              </Button>
            </div>
          )}

          {/* === STEP 3: Produtos (múltiplos) === */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Cadastre os produtos que você compra regularmente. Você pode adicionar mais depois nas configurações.
              </p>

              {produtos.map((p, idx) => (
                <div key={p.id} className="border rounded-lg p-3 space-y-2 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Produto {idx + 1}</span>
                    {produtos.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeProduto(p.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Nome *</Label>
                      <Input
                        placeholder="Ex: Arroz 5kg"
                        value={p.nome}
                        onChange={(e) => updateProduto(p.id, "nome", e.target.value)}
                        autoFocus={idx === 0}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Embalagem</Label>
                      <Input
                        placeholder="Ex: Pct 5kg"
                        value={p.embalagem}
                        onChange={(e) => updateProduto(p.id, "embalagem", e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <Button variant="outline" size="sm" className="w-full" onClick={addProduto}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar outro produto
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                💡 Dica: Você também pode importar produtos em massa pela tela de Produtos após concluir a configuração.
              </p>
            </div>
          )}

          {/* === STEP 4: Conclusão === */}
          {step === 4 && (
            <div className="space-y-4 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <PartyPopper className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Tudo pronto! 🎉</h3>
              <p className="text-muted-foreground text-sm">
                Seu ambiente foi configurado com sucesso. Veja o resumo:
              </p>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-left text-sm">
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-primary" />
                  <span><strong>1</strong> loja cadastrada{lojaSaved && `: ${lojaNome}`}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-primary" />
                  <span><strong>{fornSavedCount || fornecedores.filter((f) => f.nome.trim()).length}</strong> fornecedor(es) cadastrado(s)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  <span><strong>{prodSavedCount || produtos.filter((p) => p.nome.trim()).length}</strong> produto(s) cadastrado(s)</span>
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm text-left space-y-2">
                <p className="font-medium text-primary">📋 Próximos passos:</p>
                <ol className="list-decimal list-inside text-muted-foreground space-y-1 text-xs">
                  <li>Acesse o <strong>Painel</strong> e clique em <strong>Nova Cotação</strong></li>
                  <li>Adicione os produtos que deseja cotar</li>
                  <li>Selecione os fornecedores e envie os links</li>
                  <li>Aguarde as respostas e analise os melhores preços</li>
                </ol>
              </div>

              <p className="text-xs text-muted-foreground">
                Você pode gerenciar lojas, fornecedores e produtos a qualquer momento pelo menu <strong>Mais</strong>.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t">
          <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
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
                  Começar a usar
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
