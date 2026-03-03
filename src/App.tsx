import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import LoginPage from "./pages/LoginPage";
import CotacaoPage from "./pages/CotacaoPage";
import PedidosPage from "./pages/PedidosPage";
import ProdutosPage from "./pages/ProdutosPage";
import FornecedoresPage from "./pages/FornecedoresPage";
import HistoricoPage from "./pages/HistoricoPage";
import FornecedorCotacaoPage from "./pages/FornecedorCotacaoPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/fornecedor/:token" element={<FornecedorCotacaoPage />} />
          
          <Route element={<AppLayout />}>
            <Route path="/cotacao" element={<CotacaoPage />} />
            <Route path="/pedidos" element={<PedidosPage />} />
            <Route path="/produtos" element={<ProdutosPage />} />
            <Route path="/fornecedores" element={<FornecedoresPage />} />
            <Route path="/historico" element={<HistoricoPage />} />
          </Route>

          <Route path="/" element={<Navigate to="/cotacao" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
