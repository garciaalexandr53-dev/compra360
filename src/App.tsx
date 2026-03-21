import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { LojaProvider } from "@/hooks/useLojaAtiva";
import { ThemeProvider } from "@/hooks/useTheme";
import LandingSkeleton from "./components/LandingSkeleton";
const LandingPage = lazy(() => import("./pages/LandingPage"));

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
            <Suspense fallback={null}>
              <PriceNotificationListener />
            </Suspense>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Suspense fallback={<LandingSkeleton />}><LandingPage /></Suspense>} />
                <Route path="/login" element={<Suspense fallback={null}><LoginPage /></Suspense>} />
                <Route path="/fornecedor/:token" element={<Suspense fallback={null}><FornecedorCotacaoPage /></Suspense>} />
                <Route path="/app-funcionarios" element={<Suspense fallback={null}><AppFuncionariosPublic /></Suspense>} />
                
                <Route element={<Suspense fallback={null}><AppLayout /></Suspense>}>
                  <Route path="/dashboard" element={<Suspense fallback={null}><DashboardPage /></Suspense>} />
                  <Route path="/cotacao" element={<Suspense fallback={null}><CotacaoPage /></Suspense>} />
                  <Route path="/produtos" element={<Suspense fallback={null}><ProdutosPage /></Suspense>} />
                  <Route path="/fornecedores" element={<Suspense fallback={null}><FornecedoresPage /></Suspense>} />
                  <Route path="/funcionarios" element={<Suspense fallback={null}><FuncionariosPage /></Suspense>} />
                  <Route path="/historico" element={<Suspense fallback={null}><HistoricoPage /></Suspense>} />
                  <Route path="/analise" element={<Suspense fallback={null}><AnalisePage /></Suspense>} />
                  <Route path="/conferencias" element={<Suspense fallback={null}><ConferenciasPage /></Suspense>} />
                  <Route path="/lojas" element={<Suspense fallback={null}><LojasPage /></Suspense>} />
                </Route>

                {/* Legacy redirects */}
                <Route path="/resumo" element={<Navigate to="/analise" replace />} />
                <Route path="/pedidos" element={<Navigate to="/analise" replace />} />
                <Route path="/guia" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Suspense fallback={null}><NotFound /></Suspense>} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </ThemeProvider>
      </LojaProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
