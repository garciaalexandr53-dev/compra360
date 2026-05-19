import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { maskTelefone, maskCNPJ, isTelefoneValido, isCNPJValido } from "@/lib/masks";

interface ProfileForm {
  nome: string;
  whatsapp: string;
}

interface LojaForm {
  nome: string;
  cnpj: string;
  razao_social: string;
  inscricao_estadual: string;
  endereco: string;
  telefone: string;
}

export default function PerfilPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { lojaAtiva } = useLojaAtiva();

  const [profile, setProfile] = useState<ProfileForm>({ nome: "", whatsapp: "" });
  const [loja, setLoja] = useState<LojaForm>({
    nome: "",
    cnpj: "",
    razao_social: "",
    inscricao_estadual: "",
    endereco: "",
    telefone: "",
  });
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const { data: profileData, isLoading: loadingProfile } = useQuery({
    queryKey: ["perfil-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("nome, whatsapp")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: lojaData, isLoading: loadingLoja } = useQuery({
    queryKey: ["perfil-loja", lojaAtiva?.id],
    enabled: !!lojaAtiva?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("lojas")
        .select("nome, cnpj, razao_social, inscricao_estadual, endereco, telefone")
        .eq("id", lojaAtiva!.id)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (profileData) {
      setProfile({
        nome: profileData.nome ?? "",
        whatsapp: maskTelefone(profileData.whatsapp ?? ""),
      });
    }
  }, [profileData]);

  useEffect(() => {
    if (lojaData) {
      setLoja({
        nome: lojaData.nome ?? "",
        cnpj: maskCNPJ(lojaData.cnpj ?? ""),
        razao_social: lojaData.razao_social ?? "",
        inscricao_estadual: lojaData.inscricao_estadual ?? "",
        endereco: lojaData.endereco ?? "",
        telefone: maskTelefone(lojaData.telefone ?? ""),
      });
    }
  }, [lojaData]);

  const handleSave = async () => {
    if (!user?.id) return;
    if (!isTelefoneValido(profile.whatsapp)) {
      toast.error("Telefone pessoal inválido");
      return;
    }
    if (!isTelefoneValido(loja.telefone)) {
      toast.error("Telefone da loja inválido");
      return;
    }
    if (!isCNPJValido(loja.cnpj)) {
      toast.error("CNPJ inválido");
      return;
    }

    setSaving(true);
    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(
          {
            user_id: user.id,
            nome: profile.nome.trim() || null,
            whatsapp: profile.whatsapp.replace(/\D/g, "") || null,
          },
          { onConflict: "user_id" },
        );
      if (profileError) throw profileError;

      if (lojaAtiva?.id) {
        const { error: lojaError } = await supabase
          .from("lojas")
          .update({
            nome: loja.nome.trim(),
            cnpj: loja.cnpj.replace(/\D/g, "") || null,
            razao_social: loja.razao_social.trim() || null,
            inscricao_estadual: loja.inscricao_estadual.trim() || null,
            endereco: loja.endereco.trim() || null,
            telefone: loja.telefone.replace(/\D/g, "") || null,
          })
          .eq("id", lojaAtiva.id);
        if (lojaError) throw lojaError;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["perfil-profile"] }),
        queryClient.invalidateQueries({ queryKey: ["perfil-loja"] }),
        queryClient.invalidateQueries({ queryKey: ["lojas"] }),
      ]);

      toast.success("Dados atualizados com sucesso");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
      toast.success("Email de redefinição enviado");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao enviar email";
      toast.error(msg);
    } finally {
      setSendingReset(false);
    }
  };

  const loading = loadingProfile || loadingLoja;

  return (
    <div className="container max-w-3xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          aria-label="Voltar ao menu anterior"
          className="gap-1.5 -ml-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar</span>
        </Button>
        <h1 className="text-xl md:text-2xl font-bold ml-1">Meus dados</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados pessoais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome completo</Label>
                <Input
                  id="nome"
                  value={profile.nome}
                  onChange={(e) => setProfile({ ...profile, nome: e.target.value })}
                  placeholder="Seu nome"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp">Telefone</Label>
                <Input
                  id="whatsapp"
                  value={profile.whatsapp}
                  onChange={(e) => setProfile({ ...profile, whatsapp: maskTelefone(e.target.value) })}
                  placeholder="(00) 00000-0000"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user?.email ?? ""} readOnly disabled />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Dados da loja {lojaAtiva ? `— ${lojaAtiva.nome}` : ""}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!lojaAtiva ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma loja selecionada.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="loja-nome">Nome da loja</Label>
                    <Input
                      id="loja-nome"
                      value={loja.nome}
                      onChange={(e) => setLoja({ ...loja, nome: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input
                      id="cnpj"
                      value={loja.cnpj}
                      onChange={(e) => setLoja({ ...loja, cnpj: maskCNPJ(e.target.value) })}
                      placeholder="00.000.000/0000-00"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ie">Inscrição estadual</Label>
                    <Input
                      id="ie"
                      value={loja.inscricao_estadual}
                      onChange={(e) =>
                        setLoja({ ...loja, inscricao_estadual: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="razao">Razão social</Label>
                    <Input
                      id="razao"
                      value={loja.razao_social}
                      onChange={(e) => setLoja({ ...loja, razao_social: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="loja-tel">Telefone da loja</Label>
                    <Input
                      id="loja-tel"
                      value={loja.telefone}
                      onChange={(e) =>
                        setLoja({ ...loja, telefone: maskTelefone(e.target.value) })
                      }
                      placeholder="(00) 00000-0000"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="endereco">Endereço completo</Label>
                    <Textarea
                      id="endereco"
                      value={loja.endereco}
                      onChange={(e) => setLoja({ ...loja, endereco: e.target.value })}
                      rows={2}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Segurança</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={handlePasswordReset}
                disabled={sendingReset || !user?.email}
                className="w-full md:w-auto"
              >
                {sendingReset ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4 mr-2" />
                )}
                Alterar senha
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Enviaremos um email para {user?.email} com o link de redefinição.
              </p>
            </CardContent>
          </Card>

          <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t -mx-4 md:mx-0 px-4 md:px-0 py-3 md:static md:border-0 md:bg-transparent md:backdrop-blur-0 md:py-0">
            <Button onClick={handleSave} disabled={saving} className="w-full md:w-auto">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar alterações
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
