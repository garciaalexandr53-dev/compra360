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

function retryImport(factory: () => Promise<any>, retries = 1): Promise<any> {
  return factory().catch((err) => {
    if (retries > 0) {
      return retryImport(factory, retries - 1);
    }
    window.location.reload();
    throw err;
  });
}

const LandingPage = lazy(() => retryImport(() => import("./pages/LandingPage")));
const AppLayout = lazy(() => retryImport(() => import("./components/AppLayout")));
const LoginPage = lazy(() => retryImport(() => import("./pages/LoginPage")));
const CotacaoPage = lazy(() => retryImport(() => import("./pages/CotacaoPage")));
const ProdutosPage = lazy(() => retryImport(() => import("./pages/ProdutosPage")));
const FornecedoresPage = lazy(() => retryImport(() => import("./pages/FornecedoresPage")));
const HistoricoPage = lazy(() => retryImport(() => import("./pages/HistoricoPage")));
const DashboardPage = lazy(() => retryImport(() => import("./pages/DashboardPage")));
const AnalisePage = lazy(() => retryImport(() => import("./pages/AnalisePage")));
const FornecedorCotacaoPage = lazy(() => retryImport(() => import("./pages/FornecedorCotacaoPage")));
const FuncionariosPage = lazy(() => retryImport(() => import("./pages/FuncionariosPage")));
const AppFuncionariosPublic = lazy(() => retryImport(() => import("./pages/AppFuncionariosPublic")));
const ConferenciasPage = lazy(() => retryImport(() => import("./pages/ConferenciasPage")));
const LojasPage = lazy(() => retryImport(() => import("./pages/LojasPage")));
const AddProdutosCotacaoPage = lazy(() => retryImport(() => import("./pages/AddProdutosCotacaoPage")));
const AdminPage = lazy(() => retryImport(() => import("./pages/AdminPage")));
const NotFound = lazy(() => retryImport(() => import("./pages/NotFound")));
const UnsubscribePage = lazy(() => retryImport(() => import("./pages/UnsubscribePage")));
const PriceNotificationListener = lazy(() => retryImport(() => import("./components/PriceNotificationListener")));

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
                <Route path="/admin" element={<Suspense fallback={null}><AdminPage /></Suspense>} />
                <Route path="/unsubscribe" element={<Suspense fallback={null}><UnsubscribePage /></Suspense>} />
                
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
                  <Route path="/add-produtos" element={<Suspense fallback={null}><AddProdutosCotacaoPage /></Suspense>} />
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
