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
import { Store, Users, Package, Sparkles, ArrowLeft, ArrowRight, Check, X, PartyPopper } from "lucide-react";
import CotacaoDemo from "@/components/onboarding/CotacaoDemo";
import { useAuth } from "@/hooks/useAuth";
import { getDeviceFingerprint } from "@/lib/fingerprint";
import { formatNomeEmpresa, formatNomePessoa, formatNomeLoja } from "@/lib/masks";
import { useConsultaCNPJ } from "@/hooks/useConsultaCNPJ";
import CnpjStatus from "@/components/CnpjStatus";
import { formatCEP } from "@/components/lojas/lojaUtils";
import EnderecoFields, { type EnderecoValue } from "@/components/lojas/EnderecoFields";

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

export default function OnboardingWizard({ open, onClose }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  // Step 1 - Loja
  const [lojaNome, setLojaNome] = useState("");
  const [lojaCnpj, setLojaCnpj] = useState("");
  const receitaCnpj = useConsultaCNPJ(lojaCnpj, (d) => {
    setLojaNome((n) => (n.trim() ? n : d.nome_fantasia || d.razao_social));
    setLojaEndereco((prev) => ({
      cep: prev.cep.trim() ? prev.cep : formatCEP(d.cep),
      endereco: prev.endereco.trim() ? prev.endereco : d.logradouro,
      numero: prev.numero.trim() ? prev.numero : d.numero,
      bairro: prev.bairro.trim() ? prev.bairro : d.bairro,
      cidade: prev.cidade.trim() ? prev.cidade : d.municipio,
      uf: prev.uf.trim() ? prev.uf : d.uf,
    }));
  });
  const [lojaEndereco, setLojaEndereco] = useState<EnderecoValue>({
    cep: "",
    endereco: "",
    numero: "",
    bairro: "",
    cidade: "",
    uf: "",
  });
  const lojaCidade = lojaEndereco.cidade;
  const lojaUf = lojaEndereco.uf;

  // Step 2 - Fornecedores (múltiplos)
  const [fornecedores, setFornecedores] = useState<FornecedorDraft[]>([emptyFornecedor()]);

  // Tracking saved state
  const [lojaSaved, setLojaSaved] = useState(false);
  const [createdLojaId, setCreatedLojaId] = useState<string | null>(null);
  const [fornSavedCount, setFornSavedCount] = useState(0);

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

        const { data: lojaData, error } = await supabase.from("lojas").insert({
          nome: lojaNome.trim(),
          cidade: lojaCidade.trim(),
          uf: lojaUf.trim() ? lojaUf.trim().toUpperCase() : null,
          cep: lojaEndereco.cep.trim() || null,
          endereco: lojaEndereco.endereco.trim() || null,
          numero: lojaEndereco.numero.trim() || null,
          bairro: lojaEndereco.bairro.trim() || null,
          cnpj: cnpjDigits.length === 14 ? cnpjDigits : null,
          user_id: user?.id,
        }).select("id").single();
        if (error) throw error;

        // Store loja ID for linking fornecedores later
        if (lojaData) setCreatedLojaId(lojaData.id);

        if (fingerprint && user?.id) {
          await supabase.from("trial_controls" as any).upsert({
            user_id: user.id,
            device_fingerprint: fingerprint,
          }, { onConflict: "user_id" });
        }

        setLojaSaved(true);
        qc.invalidateQueries({ queryKey: ["lojas"] });
        qc.invalidateQueries({ queryKey: ["user-plan"] });
      }
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
      return;
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    if (step === 1) {
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
    if (step === 1) return lojaNome.trim().length > 0 && lojaCidade.trim().length > 0;
    return true; // conclusão
  };

  const stepIcons = [Sparkles, Store, Users, Package, PartyPopper];
  const stepLabels = ["Início", "Loja", "Fornecedores", "Produtos", "Pronto!"];

  return (<>
    <Dialog open={open} onOpenChange={(o) => !o && handleSkip()}>
      <DialogContent className="sm:max-w-lg">
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
          <div className="flex gap-1 min-w-0">
            {stepLabels.map((label, i) => {
              const Icon = stepIcons[i];
              return (
                <div
                  key={label}
                  className={`flex-1 min-w-0 flex flex-col items-center gap-1 text-xs ${
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
                  <Users className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span><strong>Fornecedores</strong> — veja como as cotações chegam até eles</span>
                </div>
                <div className="flex items-start gap-2">
                  <Package className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span><strong>Produtos</strong> — mais de 11.500 já vêm prontos, sem cadastro</span>
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
                Comece pelo CNPJ: o restante é preenchido automaticamente.
              </p>
              <div className="space-y-2">
                <Label htmlFor="loja-cnpj">CNPJ *</Label>
                <Input
                  id="loja-cnpj"
                  placeholder="00.000.000/0000-00"
                  value={lojaCnpj}
                  onChange={(e) => setLojaCnpj(formatCNPJ(e.target.value))}
                  maxLength={18}
                  autoFocus
                  inputMode="numeric"
                />
                <CnpjStatus status={receitaCnpj.status} dados={receitaCnpj.dados} />
                <p className="text-xs text-muted-foreground">Necessário para ativar o teste grátis. Buscamos na Receita e preenchemos nome e endereço — você pode editar tudo.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="loja-nome">Nome da Loja *</Label>
                <Input
                  id="loja-nome"
                  placeholder="Ex: Mercado Central"
                  value={lojaNome}
                  onChange={(e) => setLojaNome(e.target.value)}
                />
              </div>
              <EnderecoFields compact value={lojaEndereco} onChange={setLojaEndereco} />
              <p className="text-xs text-muted-foreground -mt-1">
                Usamos a cidade para sugerir fornecedores que já atendem na sua região.
              </p>
            </div>
          )}

          {/* === STEP 2: Fornecedores (informativo) === */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-center">
                Fornecedores — cadastre quando quiser
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                As cotações chegam direto no WhatsApp dos seus fornecedores. Eles abrem o link e preenchem os preços pelo celular, sem precisar instalar nada.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Depois de concluir, na aba <strong>Fornecedores</strong> você confere parceiros já cadastrados na sua região ou adiciona os seus.
              </p>
            </div>
          )}

          {/* === STEP 3: Produtos (informativo) === */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-center">
                Produtos — você não precisa cadastrar nada
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Seu Compra360 já vem com mais de 11.500 produtos de supermercado prontos para uso, com embalagem e fator conferidos.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Ao montar uma cotação, basta buscar pelo nome ou escanear o código de barras — o produto aparece na hora.
              </p>
              <p className="text-xs text-muted-foreground">
                Tem itens próprios (a granel, regionais)? Você pode cadastrá-los depois em <strong>Produtos</strong>.
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
                Sua loja está pronta. Veja em 5 passos como funciona uma cotação:
              </p>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-left text-sm">
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-primary" />
                  <span><strong>1</strong> loja cadastrada{lojaSaved && `: ${lojaNome}`}</span>
                </div>
              </div>

              <CotacaoDemo />

              <p className="text-xs text-muted-foreground">
                Você pode gerenciar lojas, fornecedores e produtos a qualquer momento pelo menu <strong>Mais</strong>.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between pt-2 border-t gap-2">
          {step === 3 ? (
            <span className="hidden sm:block" />
          ) : (
            <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground w-full sm:w-auto">
              <X className="h-4 w-4 mr-1 shrink-0" />
              <span className="truncate">Pular por agora</span>
            </Button>
          )}
          <div className="flex gap-2 w-full sm:w-auto">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={handleBack} disabled={saving} className="flex-1 sm:flex-none min-w-0">
                <ArrowLeft className="h-4 w-4 mr-1 shrink-0" />
                <span className="truncate">Voltar</span>
              </Button>
            )}
            <Button size="sm" onClick={handleNext} disabled={!canAdvance() || saving} className="flex-1 sm:flex-none min-w-0">
              {step === totalSteps - 1 ? (
                <>
                  <Check className="h-4 w-4 mr-1 shrink-0" />
                  <span className="truncate">Começar a usar</span>
                </>
              ) : (
                <>
                  <span className="truncate">Avançar</span>
                  <ArrowRight className="h-4 w-4 ml-1 shrink-0" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
