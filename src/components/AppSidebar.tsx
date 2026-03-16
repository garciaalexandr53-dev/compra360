import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NavLink, useLocation } from "react-router-dom";
import { useLojaAtiva } from "@/hooks/useLojaAtiva";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { BarChart3, Package, Users, ShoppingCart, TrendingUp, History, Link2, UserCheck, BookOpen, ClipboardCheck, Store } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

// Fluxo natural: Preparar → Cotar → Analisar → Pedir
const prepararMenu = [
  { title: "Lojas", url: "/lojas", icon: Store, emoji: "🏪" },
  { title: "Banco de Produtos", url: "/produtos", icon: Package, emoji: "🗄️" },
  { title: "Fornecedores", url: "/fornecedores", icon: Users, emoji: "⚙️" },
  { title: "App Funcionários", url: "/funcionarios", icon: UserCheck, emoji: "👥" },
];
const cotarMenu = [
  { title: "Cotação", url: "/cotacao", icon: BarChart3, emoji: "📊" },
  { title: "Links p/ Fornecedores", url: "/links", icon: Link2, emoji: "🔗" },
];
const analisarMenu = [
  { title: "Resumo", url: "/resumo", icon: TrendingUp, emoji: "📈" },
  { title: "Pedidos", url: "/pedidos", icon: ShoppingCart, emoji: "📦" },
  { title: "Conferências", url: "/conferencias", icon: ClipboardCheck, emoji: "📋" },
];
const sistemaMenu = [
  { title: "Histórico", url: "/historico", icon: History, emoji: "🕐" },
  { title: "Como Usar", url: "/guia", icon: BookOpen, emoji: "📖" },
];

export function AppSidebar() {
  const { state, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const isMobile = useIsMobile();
  const { lojaAtiva } = useLojaAtiva();

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

  const { data: fornecedorCount = 0 } = useQuery({
    queryKey: ["fornecedor-count"],
    queryFn: async () => {
      const { count } = await supabase.from("fornecedores").select("*", { count: "exact", head: true });
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
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const renderMenu = (items: typeof prepararMenu) => (
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
      <SidebarHeader className="p-4">
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[hsl(var(--brand-light))] to-[hsl(var(--brand))] flex items-center justify-center text-white text-xs font-extrabold shadow-md">
              ✦
            </div>
            <span className="text-lg font-bold text-sidebar-foreground">
              Cota<span className="text-sidebar-primary">Fácil</span>
            </span>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[hsl(var(--brand-light))] to-[hsl(var(--brand))] flex items-center justify-center text-white text-xs font-extrabold shadow-md mx-auto">
            ✦
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>1. Preparar</SidebarGroupLabel>
          <SidebarGroupContent>{renderMenu(prepararMenu)}</SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>2. Cotar</SidebarGroupLabel>
          <SidebarGroupContent>{renderMenu(cotarMenu)}</SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>3. Analisar</SidebarGroupLabel>
          <SidebarGroupContent>{renderMenu(analisarMenu)}</SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Sistema</SidebarGroupLabel>
          <SidebarGroupContent>{renderMenu(sistemaMenu)}</SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        {!collapsed && (
          <div className="grid grid-cols-3 gap-1 bg-sidebar-accent/50 border border-sidebar-border rounded-lg p-2.5">
            <div className="text-center">
              <span className="block text-[15px] font-bold text-sidebar-foreground">{itemCount}</span>
              <span className="text-[8.5px] text-sidebar-foreground/35 uppercase tracking-wider">Itens</span>
            </div>
            <div className="text-center">
              <span className="block text-[15px] font-bold text-sidebar-foreground">{fornecedorCount}</span>
              <span className="text-[8.5px] text-sidebar-foreground/35 uppercase tracking-wider">Forn.</span>
            </div>
            <div className="text-center">
              <span className="block text-[15px] font-bold text-sidebar-foreground">{respostaCount}</span>
              <span className="text-[8.5px] text-sidebar-foreground/35 uppercase tracking-wider">Resp.</span>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
