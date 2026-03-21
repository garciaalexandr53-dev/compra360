import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { LojaProvider } from "@/hooks/useLojaAtiva";
import { ThemeProvider } from "@/hooks/useTheme";
import LandingPage from "./pages/LandingPage";

const AppLayout = lazy(() => import("./components/AppLayout"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const CotacaoPage = lazy(() => import("./pages/CotacaoPage"));
const ProdutosPage = lazy(() => import("./pages/ProdutosPage"));
const FornecedoresPage = lazy(() => import("./pages/FornecedoresPage"));
const HistoricoPage = lazy(() => import("./pages/HistoricoPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const AnalisePage = lazy(() => import("./pages/AnalisePage"));
const FornecedorCotacaoPage = lazy(() => import("./pages/FornecedorCotacaoPage"));
const FuncionariosPage = lazy(() => import("./pages/FuncionariosPage"));
const AppFuncionariosPublic = lazy(() => import("./pages/AppFuncionariosPublic"));
const ConferenciasPage = lazy(() => import("./pages/ConferenciasPage"));
const LojasPage = lazy(() => import("./pages/LojasPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PriceNotificationListener = lazy(() => import("./components/PriceNotificationListener"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <LojaProvider>
        <ThemeProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <PriceNotificationListener />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/fornecedor/:token" element={<FornecedorCotacaoPage />} />
                <Route path="/app-funcionarios" element={<AppFuncionariosPublic />} />
                
                <Route element={<AppLayout />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/cotacao" element={<CotacaoPage />} />
                  <Route path="/produtos" element={<ProdutosPage />} />
                  <Route path="/fornecedores" element={<FornecedoresPage />} />
                  <Route path="/funcionarios" element={<FuncionariosPage />} />
                  <Route path="/historico" element={<HistoricoPage />} />
                  <Route path="/analise" element={<AnalisePage />} />
                  <Route path="/conferencias" element={<ConferenciasPage />} />
                  <Route path="/lojas" element={<LojasPage />} />
                </Route>

                {/* Legacy redirects */}
                <Route path="/resumo" element={<Navigate to="/analise" replace />} />
                <Route path="/pedidos" element={<Navigate to="/analise" replace />} />
                <Route path="/guia" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </ThemeProvider>
      </LojaProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
