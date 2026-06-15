import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";

const WhatsAppRequiredModal = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [whatsapp, setWhatsapp] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: profile, isLoading, isFetched } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("whatsapp")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Só abre o modal depois que a query terminou de carregar — evita o flash
  // pedindo WhatsApp enquanto o perfil ainda está sendo buscado.
  const needsWhats = !!user && !isLoading && isFetched && !profile?.whatsapp;

  useEffect(() => {
    if (profile?.whatsapp) setWhatsapp(profile.whatsapp);
  }, [profile?.whatsapp]);

  const save = async () => {
    const clean = whatsapp.replace(/\D/g, "");
    if (clean.length < 10) {
      toast.error("Informe um WhatsApp válido com DDD.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ user_id: user!.id, whatsapp: clean, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar. Tente novamente.");
      return;
    }
    toast.success("WhatsApp salvo!");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["profile", user!.id] }),
      queryClient.invalidateQueries({ queryKey: ["profile-nome"] }),
      queryClient.invalidateQueries({ queryKey: ["perfil-profile"] }),
    ]);
  };

  return (
    <Dialog open={needsWhats}>
      <DialogContent className="max-w-sm" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex justify-center mb-2">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <MessageCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <DialogTitle className="text-center">Cadastre seu WhatsApp</DialogTitle>
          <DialogDescription className="text-center">
            Precisamos do seu WhatsApp para fazer contato direto sobre sua conta e suporte.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="user-whatsapp">WhatsApp (com DDD) *</Label>
          <Input
            id="user-whatsapp"
            type="tel"
            inputMode="tel"
            placeholder="(11) 99999-9999"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            autoFocus
          />
        </div>
        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default WhatsAppRequiredModal;
