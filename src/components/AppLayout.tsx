import { useState, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, Sun, Moon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { LojaSelector } from "@/components/LojaSelector";
import { useTheme } from "@/hooks/useTheme";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import BottomNav from "@/components/BottomNav";
import OnboardingWizard from "@/components/OnboardingWizard";

export default function AppLayout() {
  const { user, loading, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const { lojas, loading: lojasLoading } = useLojaAtiva();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const location = useLocation();
  const isDashboard = location.pathname === "/dashboard";
  const isFuncionarios = location.pathname === "/funcionarios";

  useEffect(() => {
    if (!lojasLoading && lojas.length === 0 && user) {
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
              ) : (
                <LojaSelector />
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={toggle}>
                {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={signOut}>
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
    </SidebarProvider>
  );
}
