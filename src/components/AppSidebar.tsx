import { ShoppingCart, Package, Users, BarChart3, History, TrendingUp, Link2 } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const mainMenu = [
  { title: "Cotação", url: "/cotacao", icon: BarChart3 },
  { title: "Banco de Produtos", url: "/produtos", icon: Package },
  { title: "Fornecedores", url: "/fornecedores", icon: Users },
];

const analysisMenu = [
  { title: "Pedidos", url: "/pedidos", icon: ShoppingCart },
  { title: "Resumo", url: "/resumo", icon: TrendingUp },
];

const systemMenu = [
  { title: "Histórico", url: "/historico", icon: History },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  const renderMenu = (items: typeof mainMenu) => (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton
            asChild
            isActive={location.pathname === item.url || location.pathname.startsWith(item.url + "/")}
          >
            <NavLink to={item.url} className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
              <item.icon className="h-4 w-4" />
              {!collapsed && <span>{item.title}</span>}
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
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
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>{renderMenu(mainMenu)}</SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Análise</SidebarGroupLabel>
          <SidebarGroupContent>{renderMenu(analysisMenu)}</SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Sistema</SidebarGroupLabel>
          <SidebarGroupContent>{renderMenu(systemMenu)}</SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        {!collapsed && (
          <p className="text-xs text-sidebar-foreground/40">CotaFácil v1.0</p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
