import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Regression guard: páginas públicas / acessadas por token de fornecedor
 * NÃO podem consultar diretamente as tabelas sensíveis abaixo via
 * `supabase.from("...")`. Todo acesso deve ser feito por RPC
 * SECURITY DEFINER que valida o token do fornecedor.
 *
 * Se este teste falhar, mova a query para uma função RPC nova/existente
 * (ex.: get_supplier_cotacao_produtos) em vez de remover este guard.
 */

const FORBIDDEN_TABLES = ["cotacao_produtos", "produtos", "categorias"];

// Páginas servidas sem sessão autenticada do dono dos dados
const PUBLIC_PAGES = [
  "src/pages/FornecedorCotacaoPage.tsx",
  "src/pages/AppFuncionariosPublic.tsx",
];

const buildPattern = (table: string) =>
  new RegExp(`\\.from\\(\\s*["'\\\`]${table}["'\\\`]\\s*\\)`);

describe("Regressão: páginas públicas sem acesso direto a tabelas sensíveis", () => {
  for (const file of PUBLIC_PAGES) {
    for (const table of FORBIDDEN_TABLES) {
      it(`${file} não pode usar supabase.from("${table}")`, () => {
        const content = readFileSync(resolve(process.cwd(), file), "utf-8");
        const pattern = buildPattern(table);
        const match = content.match(pattern);
        expect(
          match,
          `Acesso direto a "${table}" detectado em ${file}. ` +
            `Use uma RPC SECURITY DEFINER (ex.: get_supplier_cotacao_produtos) ` +
            `que valide o token do fornecedor antes de retornar dados.`
        ).toBeNull();
      });
    }
  }
});
