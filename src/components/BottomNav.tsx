import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, BarChart3, TrendingUp, MoreHorizontal, Package, Users, Store, ClipboardCheck, History, Shield, UserCog, PackageOpen, MessageCircleQuestion } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useProfile } from "@/hooks/useProfile";
import { useSubscription } from "@/hooks/useSubscription";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { buildSuporteUrl } from "@/lib/suporte";

const tabs = [
  { label: "Painel", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Cotação", icon: BarChart3, path: "/cotacao" },
  { label: "Análise", icon: TrendingUp, path: "/analise" },
  { label: "Mais", icon: MoreHorizontal, path: "__more__" },
];

const moreItems = [
  { label: "Produtos", icon: Package, path: "/produtos" },
  { label: "Fornecedores", icon: Users, path: "/fornecedores" },
  { label: "Lojas", icon: Store, path: "/lojas" },
  { label: "Reposição", icon: PackageOpen, path: "/funcionarios" },
  { label: "Conferências", icon: ClipboardCheck, path: "/conferencias" },
  { label: "Histórico", icon: History, path: "/historico" },
  { label: "Meus dados", icon: UserCog, path: "/perfil" },
];

const helpItem = { label: "Ajuda", icon: MessageCircleQuestion, path: "__help__" };

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const { nome } = useProfile();
  const { plan } = useSubscription();
  const { lojaAtiva } = useLojaAtiva();

  const suporteUrl = buildSuporteUrl({
    nome,
    email: user?.email,
    plano: plan?.display_name,
    loja: lojaAtiva?.nome,
  });

  const { data: isAdmin = false } = useQuery({
    queryKey: ["is-admin-bottomnav", user?.id],
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

  const items = isAdmin
    ? [...moreItems, { label: "Admin", icon: Shield, path: "/admin" }]
    : moreItems;

  const isActive = (path: string) => {
    if (path === "__more__") return items.some((i) => location.pathname.startsWith(i.path));
    if (path === "__help__") return false;
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const handleTap = (path: string) => {
    if (path === "__more__") {
      setMoreOpen(true);
    } else if (path === "__help__") {
      window.open(suporteUrl, "_blank", "noopener,noreferrer");
    } else {
      navigate(path);
    }
  };

  const handleMoreItemTap = (path: string) => {
    if (path === "__help__") {
      window.open(suporteUrl, "_blank", "noopener,noreferrer");
    } else {
      navigate(path);
    }
    setMoreOpen(false);
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t md:hidden safe-area-bottom">
        <div className="flex items-stretch min-h-14">
          {tabs.map((tab) => {
            const active = isActive(tab.path);
            return (
              <button
                key={tab.path}
                onClick={() => handleTap(tab.path)}
                className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-1 py-1.5 transition-colors ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                <tab.icon className="h-5 w-5 shrink-0" />
                <span className="text-[10px] leading-tight font-medium whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-base">Mais opções</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 min-[380px]:grid-cols-3 gap-3 py-2">
            {items.map((item) => {
              const active = location.pathname.startsWith(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setMoreOpen(false);
                  }}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors ${
                    active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
