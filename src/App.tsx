import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { LojaProvider } from "@/hooks/useLojaAtiva";
import AppLayout from "./components/AppLayout";
import LoginPage from "./pages/LoginPage";
import CotacaoPage from "./pages/CotacaoPage";
import ProdutosPage from "./pages/ProdutosPage";
import FornecedoresPage from "./pages/FornecedoresPage";
import HistoricoPage from "./pages/HistoricoPage";
import DashboardPage from "./pages/DashboardPage";
import AnalisePage from "./pages/AnalisePage";
import FornecedorCotacaoPage from "./pages/FornecedorCotacaoPage";
import FuncionariosPage from "./pages/FuncionariosPage";
import AppFuncionariosPublic from "./pages/AppFuncionariosPublic";
import ConferenciasPage from "./pages/ConferenciasPage";
import LojasPage from "./pages/LojasPage";
import NotFound from "./pages/NotFound";
import PriceNotificationListener from "./components/PriceNotificationListener";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <LojaProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <PriceNotificationListener />
          <BrowserRouter>
            <Routes>
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

              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              {/* Legacy redirects */}
              <Route path="/resumo" element={<Navigate to="/analise" replace />} />
              <Route path="/pedidos" element={<Navigate to="/analise" replace />} />
              <Route path="/guia" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </LojaProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
