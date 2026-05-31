import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative, sep } from "node:path";

/**
 * Regressão: nenhum arquivo do frontend servido em rotas PÚBLICAS
 * (sem sessão autenticada do dono dos dados) pode consultar diretamente
 * as tabelas sensíveis abaixo via `supabase.from("...")`.
 *
 * Todo acesso a esses dados em contexto público deve passar por uma
 * RPC SECURITY DEFINER (ex.: get_supplier_cotacao_produtos) que valida
 * o token do fornecedor antes de retornar qualquer linha.
 *
 * O teste varre TODO o diretório src/ — não apenas as páginas conhecidas —
 * e falha se encontrar acesso direto em qualquer arquivo fora da whitelist
 * de código autenticado do comprador.
 */

const FORBIDDEN_TABLES = ["cotacao_produtos", "produtos", "categorias"];

// Diretórios considerados "comprador autenticado" — podem usar queries diretas
// (RLS protege os dados via auth.uid()).
const AUTHENTICATED_DIRS = [
  "src/components",
  "src/hooks",
  "src/lib",
  "src/integrations",
  "src/test",
];

// Páginas em src/pages que NÃO são rotas públicas (exigem login do dono dos dados).
// Qualquer outra página em src/pages é tratada como pública e NÃO pode consultar
// diretamente as tabelas sensíveis.
const AUTHENTICATED_PAGES = new Set(
  [
    "AddProdutosCotacaoPage.tsx",
    "AnalisePage.tsx",
    "ConferenciasPage.tsx",
    "CotacaoPage.tsx",
    "DashboardPage.tsx",
    "FornecedoresPage.tsx",
    "FuncionariosPage.tsx",
    "GuiaPage.tsx",
    "HistoricoPage.tsx",
    "LinksPage.tsx",
    "LojasPage.tsx",
    "PedidosPage.tsx",
    "PerfilPage.tsx",
    "ProdutosPage.tsx",
    "ResumoPage.tsx",
    // Admin é restrito por user_roles mas o usuário está autenticado.
    "AdminPage.tsx",
  ].map((f) => f.toLowerCase())
);

const SRC_ROOT = resolve(process.cwd(), "src");

const buildPattern = (table: string) =>
  new RegExp(`\\.from\\(\\s*["'\\\`]${table}["'\\\`]\\s*\\)`);

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

function isAuthenticatedFile(absPath: string): boolean {
  const rel = relative(process.cwd(), absPath).split(sep).join("/");

  // Whitelist de diretórios "comprador autenticado".
  if (AUTHENTICATED_DIRS.some((d) => rel.startsWith(d + "/"))) return true;

  // Páginas autenticadas explicitamente listadas.
  if (rel.startsWith("src/pages/")) {
    const file = rel.slice("src/pages/".length).toLowerCase();
    // Subpastas dentro de src/pages também tratadas como autenticadas.
    if (file.includes("/")) return true;
    if (AUTHENTICATED_PAGES.has(file)) return true;
    return false; // demais arquivos em src/pages = públicos
  }

  // Arquivos soltos em src/ (App.tsx, main.tsx, etc.) — autenticados.
  return true;
}

const allFiles = walk(SRC_ROOT);
const publicFiles = allFiles.filter((f) => !isAuthenticatedFile(f));

describe("Regressão: arquivos públicos sem acesso direto a tabelas sensíveis", () => {
  it("descobre pelo menos uma página pública para varrer", () => {
    // Garante que a heurística não fique vazia silenciosamente após renomes.
    expect(publicFiles.length).toBeGreaterThan(0);
  });

  for (const absPath of publicFiles) {
    const rel = relative(process.cwd(), absPath).split(sep).join("/");
    for (const table of FORBIDDEN_TABLES) {
      it(`${rel} não pode usar supabase.from("${table}")`, () => {
        const content = readFileSync(absPath, "utf-8");
        const match = content.match(buildPattern(table));
        expect(
          match,
          `Acesso direto a "${table}" detectado em ${rel}. ` +
            `Esse arquivo é servido em rota pública — use uma RPC ` +
            `SECURITY DEFINER (ex.: get_supplier_cotacao_produtos) que ` +
            `valide o token do fornecedor antes de retornar dados, ou ` +
            `adicione o arquivo à whitelist de páginas autenticadas se ` +
            `ele de fato exige login.`
        ).toBeNull();
      });
    }
  }
});
