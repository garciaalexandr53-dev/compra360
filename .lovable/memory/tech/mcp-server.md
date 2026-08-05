---
name: MCP Server (Integrações de agentes)
description: App MCP server via @lovable.dev/mcp-js, OAuth Supabase, 7 ferramentas, consent em /.lovable/oauth/consent
type: feature
---
- Servidor MCP autoral em `src/lib/mcp/` (entry `index.ts`, tools em `tools/`, client factory em `supabase.ts`). Plugin `mcpPlugin()` no vite.config gera `supabase/functions/mcp/index.ts` (nunca editar à mão).
- Auth: OAuth 2.1 do Supabase, issuer `https://<VITE_SUPABASE_PROJECT_ID>.supabase.co/auth/v1`. Tools usam `supabaseForUser(ctx)` → RLS do usuário. Nunca service role.
- Tela de consentimento: `src/pages/OAuthConsent.tsx` rota `/.lovable/oauth/consent`. LoginPage respeita `?next=` (senha, signup emailRedirectTo e Google redirect_uri).
- Ferramentas: listar_lojas, listar_fornecedores, listar_cotacoes, detalhar_cotacao, buscar_catalogo, listar_itens_faltantes, registrar_item_faltante.
- Após qualquer mudança no MCP: rodar extract_mcp_manifest e redeploy da function `mcp` (efetiva no publish).
