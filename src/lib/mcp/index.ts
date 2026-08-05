import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listarLojas from "./tools/listar-lojas";
import listarFornecedores from "./tools/listar-fornecedores";
import listarCotacoes from "./tools/listar-cotacoes";
import detalharCotacao from "./tools/detalhar-cotacao";
import listarItensFaltantes from "./tools/listar-itens-faltantes";
import registrarItemFaltante from "./tools/registrar-item-faltante";
import buscarCatalogo from "./tools/buscar-catalogo";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "compra360",
  title: "Compra360",
  version: "0.1.0",
  instructions:
    "Ferramentas do Compra360, sistema de cotação de compras para supermercados. Use listar_lojas para descobrir as unidades do usuário, listar_fornecedores para os fornecedores cadastrados, listar_cotacoes e detalhar_cotacao para analisar preços recebidos e o melhor preço por item, buscar_catalogo para localizar produtos no catálogo mestre, e listar_itens_faltantes/registrar_item_faltante para a fila de reposição das lojas. Todas as ferramentas operam apenas nos dados do usuário autenticado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listarLojas,
    listarFornecedores,
    listarCotacoes,
    detalharCotacao,
    buscarCatalogo,
    listarItensFaltantes,
    registrarItemFaltante,
  ],
});
