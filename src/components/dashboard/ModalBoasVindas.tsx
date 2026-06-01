import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const SESSION_DISMISS_KEY = "boas-vindas-dispensado-sessao";

export default function ModalBoasVindas() {
  const { user } = useAuth();
  const { precisaNome, isLoading: profileLoading } = useProfile();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: isAdmin = false } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
  });

  useEffect(() => {
    if (!user || isAdmin || profileLoading || !precisaNome) {
      setOpen(false);
      return;
    }
    try {
      if (sessionStorage.getItem(SESSION_DISMISS_KEY)) return;
    } catch { /* ignore */ }
    setOpen(true);
  }, [user, isAdmin, profileLoading, precisaNome]);

  const handleDismiss = () => {
    try { sessionStorage.setItem(SESSION_DISMISS_KEY, "1"); } catch { /* ignore */ }
    setOpen(false);
  };

  const handleSave = async () => {
    const trimmed = nome.trim();
    if (!trimmed || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({ user_id: user.id, nome: trimmed }, { onConflict: "user_id" });
      if (error) throw error;
      const primeiro = trimmed.split(" ")[0];
      await queryClient.invalidateQueries({ queryKey: ["profile-nome"] });
      await queryClient.refetchQueries({ queryKey: ["profile-nome"] });
      toast.success(`Olá, ${primeiro}! 👋`);
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar nome");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleDismiss(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Olá! Como podemos te chamar?</DialogTitle>
          <DialogDescription>
            Seu nome aparecerá nas notificações e comunicações do sistema.
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="Seu primeiro nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
          maxLength={60}
        />
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={handleDismiss} disabled={saving}>
            Agora não
          </Button>
          <Button onClick={handleSave} disabled={saving || !nome.trim()}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
