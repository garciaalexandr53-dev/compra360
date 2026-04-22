import { useState, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, Sun, Moon, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LojaSelector } from "@/components/LojaSelector";
import { useTheme } from "@/hooks/useTheme";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import BottomNav from "@/components/BottomNav";
import OnboardingWizard from "@/components/OnboardingWizard";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function AppLayout() {
  const { user, loading, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const { lojas, loading: lojasLoading } = useLojaAtiva();
  const navigate = useNavigate();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const location = useLocation();
  const isDashboard = location.pathname === "/dashboard";
  const isFuncionarios = location.pathname === "/funcionarios";
  const isLojas = location.pathname === "/lojas";
  const isFornecedores = location.pathname === "/fornecedores";

  const { data: isAdmin = false } = useQuery({
    queryKey: ["is-admin-header", user?.id],
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
    if (!lojasLoading && lojas.length === 0 && user && !localStorage.getItem("onboarding_completed")) {
      setShowOnboarding(true);
    }
  }, [lojasLoading, lojas, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {/* Sidebar only on desktop */}
        <div className="hidden md:block">
          <AppSidebar />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b px-4 bg-card shadow-sm">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="hidden md:flex" />
              {isDashboard ? (
                <span className="text-lg font-bold text-primary tracking-tight">Compra360</span>
              ) : isFuncionarios ? (
                <span className="text-lg font-bold text-primary tracking-tight">App Funcionários</span>
              ) : isLojas ? (
                <span className="text-lg font-bold text-primary tracking-tight">Lojas</span>
              ) : isFornecedores ? (
                <span className="text-lg font-bold text-primary tracking-tight">Fornecedores</span>
              ) : (
                <LojaSelector />
              )}
            </div>
            <div className="flex items-center gap-1">
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  onClick={() => navigate("/admin")}
                  title="Painel Administrativo"
                  aria-label="Painel Administrativo"
                >
                  <Shield className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={toggle}>
                {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setShowLogoutConfirm(true)}>
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-auto pb-16 md:pb-0">
            <Outlet />
          </main>
        </div>
      </div>
      <BottomNav />
      <OnboardingWizard open={showOnboarding} onClose={() => setShowOnboarding(false)} />
      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deseja sair da conta?</AlertDialogTitle>
            <AlertDialogDescription>
              Você precisará fazer login novamente para acessar o sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={signOut}>Sair</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
