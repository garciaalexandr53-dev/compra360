import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import AppLayout from "./components/AppLayout";
import LoginPage from "./pages/LoginPage";
import CotacaoPage from "./pages/CotacaoPage";
import PedidosPage from "./pages/PedidosPage";
import ProdutosPage from "./pages/ProdutosPage";
import FornecedoresPage from "./pages/FornecedoresPage";
import HistoricoPage from "./pages/HistoricoPage";
import ResumoPage from "./pages/ResumoPage";
import FornecedorCotacaoPage from "./pages/FornecedorCotacaoPage";
import LinksPage from "./pages/LinksPage";
import FuncionariosPage from "./pages/FuncionariosPage";
import AppFuncionariosPublic from "./pages/AppFuncionariosPublic";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/fornecedor/:token" element={<FornecedorCotacaoPage />} />
            <Route path="/app-funcionarios" element={<AppFuncionariosPublic />} />
            
            <Route element={<AppLayout />}>
              <Route path="/cotacao" element={<CotacaoPage />} />
              <Route path="/pedidos" element={<PedidosPage />} />
              <Route path="/produtos" element={<ProdutosPage />} />
              <Route path="/fornecedores" element={<FornecedoresPage />} />
              <Route path="/links" element={<LinksPage />} />
              <Route path="/funcionarios" element={<FuncionariosPage />} />
              <Route path="/historico" element={<HistoricoPage />} />
              <Route path="/resumo" element={<ResumoPage />} />
            </Route>

            <Route path="/" element={<Navigate to="/cotacao" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
