
import { useQuery } from "@tanstack/react-query";
import logoCompra360 from "/compra360-icon.png";
import { supabase } from "@/integrations/supabase/client";
import { NavLink, useLocation } from "react-router-dom";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import { useAuth } from "@/hooks/useAuth";

import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { BarChart3, Package, Users, TrendingUp, History, UserCheck, ClipboardCheck, Store, LayoutDashboard, Shield } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { withAssetVersion } from "@/lib/assetVersion";

const mainMenu = [
  { title: "Painel", url: "/dashboard", icon: LayoutDashboard, emoji: "🏠" },
  { title: "Produtos", url: "/produtos", icon: Package, emoji: "🗄️" },
  { title: "Fornecedores", url: "/fornecedores", icon: Users, emoji: "⚙️" },
  { title: "Cotação", url: "/cotacao", icon: BarChart3, emoji: "📊" },
  { title: "Análise", url: "/analise", icon: TrendingUp, emoji: "📈" },
];

const maisMenu = [
  { title: "Lojas", url: "/lojas", icon: Store, emoji: "🏪" },
  { title: "App Funcionários", url: "/funcionarios", icon: UserCheck, emoji: "👥" },
  { title: "Conferências", url: "/conferencias", icon: ClipboardCheck, emoji: "📋" },
  { title: "Histórico", url: "/historico", icon: History, emoji: "🕐" },
];

export function AppSidebar() {
  const { state, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const isMobile = useIsMobile();
  const { lojaAtiva } = useLojaAtiva();
  const { user } = useAuth();

  const { data: isAdmin = false } = useQuery({
    queryKey: ["is-admin-sidebar", user?.id],
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

  const { data: cotacaoAtiva } = useQuery({
    queryKey: ["cotacao-ativa", lojaAtiva?.id],
    queryFn: async () => {
      let query = supabase.from("cotacoes").select("id").eq("status", "ativa");
      if (lojaAtiva?.id) query = query.eq("loja_id", lojaAtiva.id);
      else query = query.is("loja_id", null);
      const { data } = await query.limit(1).maybeSingle();
      return data;
    },
  });

  const { data: itemCount = 0 } = useQuery({
    queryKey: ["cotacao-item-count", cotacaoAtiva?.id],
    enabled: !!cotacaoAtiva?.id,
    queryFn: async () => {
      const { count } = await supabase.from("cotacao_produtos").select("*", { count: "exact", head: true }).eq("cotacao_id", cotacaoAtiva!.id);
      return count || 0;
    },
  });

  const { data: respostaCount = 0 } = useQuery({
    queryKey: ["resposta-count", cotacaoAtiva?.id],
    enabled: !!cotacaoAtiva?.id,
    queryFn: async () => {
      const cpIds = await supabase.from("cotacao_produtos").select("id").eq("cotacao_id", cotacaoAtiva!.id);
      if (!cpIds.data?.length) return 0;
      const ids = cpIds.data.map((cp) => cp.id);
      const { data } = await supabase.from("precos").select("fornecedor_id").in("cotacao_produto_id", ids).not("preco", "is", null);
      if (!data) return 0;
      return new Set(data.map((p) => p.fornecedor_id)).size;
    },
  });

  const getBadge = (url: string) => {
    if (url === "/cotacao" && itemCount > 0) return String(itemCount);
    if (url === "/fornecedores" && respostaCount > 0) return String(respostaCount);
    return undefined;
  };

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  const renderMenu = (items: typeof mainMenu) => (
    <SidebarMenu>
      {items.map((item) => {
        const isActive = location.pathname === item.url || location.pathname.startsWith(item.url + "/");
        return (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton asChild isActive={isActive}>
              <NavLink to={item.url} onClick={handleNavClick} className="hover:bg-sidebar-accent">
                <item.icon className="h-4 w-4" />
                {!collapsed && <span className="flex-1">{item.title}</span>}
                {!collapsed && getBadge(item.url) && (
                  <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
                    item.url === "/fornecedores" ? "bg-green-600 text-white" : "bg-primary text-primary-foreground"
                  }`}>
                    {getBadge(item.url)}
                  </span>
                )}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className={collapsed ? "p-2" : "px-4 py-6"}>
        {!collapsed ? (
          <div className="flex w-full items-center justify-center">
            <img
              src="https://gkokwhkpjfozhtgfcrhz.supabase.co/storage/v1/object/public/logoatualizada//logo-completa.png"
              alt="Compra360"
              className="block w-full max-w-[180px] h-auto object-contain mx-auto"
            />
          </div>
        ) : (
          <div className="flex w-full items-center justify-center">
            <img src={logoCompra360} alt="Compra360" className="w-8 h-8 rounded-lg shadow-md object-contain" />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Fluxo</SidebarGroupLabel>
          <SidebarGroupContent>{renderMenu(mainMenu)}</SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Mais</SidebarGroupLabel>
          <SidebarGroupContent>{renderMenu(maisMenu)}</SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border space-y-2">
        {!collapsed && cotacaoAtiva && (
          <div className="bg-sidebar-accent/50 border border-sidebar-border rounded-lg p-2.5 text-center">
            <span className="text-[8.5px] text-sidebar-foreground/35 uppercase tracking-wider">Cotação ativa</span>
            <div className="flex justify-around mt-1">
              <div className="text-center">
                <span className="block text-[15px] font-bold text-sidebar-foreground">{itemCount}</span>
                <span className="text-[8.5px] text-sidebar-foreground/35">Itens</span>
              </div>
              <div className="text-center">
                <span className="block text-[15px] font-bold text-sidebar-foreground">{respostaCount}</span>
                <span className="text-[8.5px] text-sidebar-foreground/35">Resp.</span>
              </div>
            </div>
          </div>
        )}
        {isAdmin && (
          <NavLink
            to="/admin"
            onClick={handleNavClick}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors ${
              collapsed ? "justify-center" : ""
            } ${location.pathname === "/admin" ? "text-sidebar-foreground bg-sidebar-accent/50" : ""}`}
            title="Painel Admin"
          >
            <Shield className="h-3.5 w-3.5" />
            {!collapsed && <span>Admin</span>}
          </NavLink>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
