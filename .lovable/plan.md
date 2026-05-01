## Sistema de Prazo de Cotação

Lembretes automáticos via WhatsApp **ficam fora deste plano** (decidido adicionar depois).

### 1. Migração de Banco

Adicionar campos via `supabase--migration`:

- `cotacoes.prazo_resposta` — `timestamptz NULL` (opcional, padrão sugerido 18:00 do dia)
- `cotacao_fornecedores.visualizado_em` — `timestamptz NULL` (primeira abertura do link)
- Habilitar Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE public.cotacoes, public.cotacao_fornecedores;` e `REPLICA IDENTITY FULL` em ambas
- Nova RPC `marcar_cotacao_visualizada(_token, _cotacao_id)` — `SECURITY DEFINER`, registra `visualizado_em` apenas se for `NULL` (idempotente, callable por `anon`)
- Atualizar RPC `get_cotacao_status_for_supplier` para também retornar `prazo_resposta`

### 2. Criação de Cotação — campo "Receber preços até"

Os 3 pontos de criação de cotação serão atualizados para passar `prazo_resposta`:

- `CotacaoPage.tsx` (linha 487) — botão "Nova Cotação" no header
- `DashboardPage.tsx` (linha 379) — auto-criação via Dashboard
- `AddProdutosCotacaoPage.tsx` (linha 213) — fluxo manual

Como o `ModalNovaCotacao` é o único lugar onde o comprador faz uma escolha visível antes de criar, vou adicionar nele um seletor "⏰ Receber preços até:" com:
- Input `time` (default 18:00, editável)
- Checkbox "Sem prazo definido" para limpar
- Helper text com o horário formatado

Na auto-criação do Dashboard (sem modal), aplicar o padrão **18:00 do dia atual** silenciosamente.

### 3. Tela de Acompanhamento — alterar prazo + status dos fornecedores

Em `CotacaoPage.tsx` (header da cotação ativa):

- Novo componente `PrazoCotacaoBadge`: mostra "⏰ Prazo: 18:00 (em 2h 30min)" — clicável → abre `Popover` com input time
- Ao salvar: se novo prazo < `now()`, `AlertDialog` "Esse prazo já passou. Confirmar?"
- Update direto em `cotacoes.prazo_resposta`

Em `FornecedoresPage.tsx` (ou onde os fornecedores designados são listados na cotação ativa — verificar):
- Para cada fornecedor: badge de status
  - 🔴 "Não visualizou" (sem `visualizado_em`)
  - 🟡 "Visualizou" (tem `visualizado_em`, sem preços)
  - 🟢 "Respondeu" (tem ≥1 preço > 0)
- Quando todos preencheram, banner verde no topo: "✅ Todos os fornecedores responderam — você pode fechar a cotação antecipadamente"

### 4. Página do Fornecedor — banner + contador + auto-fechamento

Em `FornecedorCotacaoPage.tsx`:

- Após carregar com `screen='ready'`, chamar RPC `marcar_cotacao_visualizada` (uma vez, silencioso, ignora erro)
- Se `prazo_resposta` retornado:
  - Banner sticky abaixo do header: "⏰ Envie seus preços até as **HH:mm** de hoje · faltam **Xh Ymin**"
  - `useEffect` com `setInterval(60s)` recalculando o tempo restante
  - Quando `now() >= prazo_resposta`, mudar `screen` para novo estado `expired` → tela amigável idêntica à `closed` mas com texto "Esta cotação já encerrou o prazo de recebimento de preços. Obrigado pela sua participação!"
- Subscription Supabase Realtime em `cotacoes` filtrada pelo `cotacao_id` → atualiza prazo no banner se comprador alterar
- Backend guard: `submit-precos` rejeita envios após `prazo_resposta` (mensagem amigável "Prazo encerrado")

### 5. Realtime no painel do comprador

Em `CotacaoPage.tsx`, novo subscription:
- `cotacao_fornecedores` filtrado por `cotacao_id` → invalida query dos status
- `precos` (já existe via `PriceNotificationListener`?) → mantém

### 6. Detalhes técnicos

- **Status por fornecedor**: query agregada em `precos` agrupada por `fornecedor_id` contando `preco > 0`, combinada com `visualizado_em` de `cotacao_fornecedores`
- **Cálculo de tempo restante**: helper puro `formatTimeRemaining(prazoIso)` em `src/lib/format.ts` retornando `{ expired, label }`
- **Padrão 18:00**: helper `defaultPrazoHoje()` retornando hoje às 18:00 (timezone local) como ISO
- **Prazo expirado**: cotação **continua `ativa`** no painel (decisão do usuário). Apenas o link público bloqueia.

### 7. Responsividade

- Banner do contador no fornecedor: stack vertical em <360px, horizontal em sm+
- Badge de status na lista de fornecedores: ícone + texto curto em mobile, completo em desktop
- Popover de alterar prazo: largura fixa 280px, abre acima em mobile (evita teclado)

### 8. Testes

- `format.test.ts`: `formatTimeRemaining` com casos (futuro, expirado, <1min)
- Sem teste de UI para Realtime (custoso); validação manual via dois browsers

### Arquivos tocados

- **Novo**: migration SQL, `src/components/cotacao/PrazoCotacaoBadge.tsx`, `src/components/cotacao/StatusFornecedorBadge.tsx`
- **Editado**: `src/lib/format.ts`, `src/components/cotacao/ModalNovaCotacao.tsx`, `src/pages/CotacaoPage.tsx`, `src/pages/DashboardPage.tsx`, `src/pages/AddProdutosCotacaoPage.tsx`, `src/pages/FornecedorCotacaoPage.tsx`, `supabase/functions/submit-precos/index.ts`
- **Não editado agora**: Edge Function de lembretes (postergada)

Ao final: `bunx vitest run` deve passar e build limpo. Memória do projeto será atualizada com a nova feature de prazo.