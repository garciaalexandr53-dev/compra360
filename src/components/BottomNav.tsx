import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, BarChart3, TrendingUp, MoreHorizontal, Package, Users, Store, UserCheck, ClipboardCheck, History, Shield, UserCog } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

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
  { label: "Funcionários", icon: UserCheck, path: "/funcionarios" },
  { label: "Conferências", icon: ClipboardCheck, path: "/conferencias" },
  { label: "Histórico", icon: History, path: "/historico" },
  { label: "Meus dados", icon: UserCog, path: "/perfil" },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

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
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const handleTap = (path: string) => {
    if (path === "__more__") {
      setMoreOpen(true);
    } else {
      navigate(path);
    }
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t md:hidden safe-area-bottom">
        <div className="flex items-stretch h-14">
          {tabs.map((tab) => {
            const active = isActive(tab.path);
            return (
              <button
                key={tab.path}
                onClick={() => handleTap(tab.path)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                <tab.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{tab.label}</span>
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
          <div className="grid grid-cols-3 gap-3 py-2">
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
