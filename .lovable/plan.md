
# Status de envio por fornecedor + histórico

Mantém o fluxo sequencial atual (wa.me, abre um fornecedor após o outro), adiciona persistência de status, botão Reenviar sempre disponível e histórico auditável. Modelo de dados já preparado para API (Twilio) futura, sem refator de tela.

## 1. Banco de dados (migração única)

### 1.1 Enum `envio_status`
`pendente | enviado | entregue | falhou` — todos criados desde já, mesmo que UI use apenas os 2 primeiros hoje.

### 1.2 Enum `envio_origem`
`manual | automatica` — manual = wa.me clicado pelo usuário, automatica = webhook da API.

### 1.3 Enum `envio_acao`
`envio_inicial | reenvio | atualizacao_status` — `atualizacao_status` reservado para webhooks que só mudam status (entregue/falhou).

### 1.4 Alterar `cotacao_fornecedores`
- `status_envio envio_status NOT NULL DEFAULT 'pendente'`
- `enviado_em timestamptz NULL`
- `ultima_atualizacao_status timestamptz NULL` (para futuro webhook)

### 1.5 Nova tabela `historico_envios`
```text
id            uuid pk
cotacao_id    uuid fk cotacoes(id) on delete cascade
fornecedor_id uuid fk fornecedores(id) on delete cascade
acao          envio_acao   not null
status        envio_status not null
origem        envio_origem not null default 'manual'
executado_por uuid null (auth.users; null quando vem de webhook)
metadata      jsonb null (payload Twilio futuro, número do pedido, etc.)
created_at    timestamptz default now()
```
- Index em `(cotacao_id, fornecedor_id, created_at desc)`.
- RLS: leitura/escrita para o dono da cotação (`cotacoes.created_by = auth.uid()`); `service_role` total (para webhook futuro).
- GRANT `authenticated` (CRUD) e `service_role` (ALL). Sem grant para `anon`.

### 1.6 Função RPC `registrar_envio_fornecedor`
`SECURITY DEFINER`, `SET search_path = public`, aceita `(_cotacao_id, _fornecedor_id, _acao, _status, _origem, _metadata)`.
- Valida que `auth.uid()` é dono da cotação (quando origem=manual).
- Atualiza `cotacao_fornecedores.status_envio`, `enviado_em` (se status=enviado e ainda null, ou se acao=reenvio sobrescreve), `ultima_atualizacao_status`.
- Insere linha em `historico_envios`.
- Tudo em uma transação → single source of truth, sem race no frontend.

## 2. Constantes compartilhadas — `src/lib/envioStatus.ts`

Exporta tipos/labels/cores únicos:
```ts
export const ENVIO_STATUS = { PENDENTE:'pendente', ENVIADO:'enviado', ENTREGUE:'entregue', FALHOU:'falhou' } as const;
export const ENVIO_ACAO = { ENVIO_INICIAL:'envio_inicial', REENVIO:'reenvio', ATUALIZACAO_STATUS:'atualizacao_status' } as const;
export const ENVIO_ORIGEM = { MANUAL:'manual', AUTOMATICA:'automatica' } as const;
export const statusMeta: Record<EnvioStatus,{label,classes,dot}> = { ... }
```
Usado por badge, modal de histórico, SendQueueModal, etc. Nenhuma string `'enviado'` hardcoded fora deste arquivo.

## 3. Camada de serviço — `src/lib/envioFornecedor.ts`

- `registrarEnvio({ cotacaoId, fornecedorId, acao, status, origem='manual', metadata? })` → chama RPC.
- `useHistoricoEnvios(cotacaoId, fornecedorId)` (hook TanStack Query).
- `useStatusEnviosCotacao(cotacaoId)` lendo `cotacao_fornecedores`.

Toda mutação invalida `['cotacao-fornecedores', cotacaoId]` e `['historico-envios', cotacaoId, fornecedorId]`.

## 4. UI — fluxo sequencial preservado

### 4.1 `SendQueueModal` (fluxo principal de envio)
- Resumo no topo: **"X de Y pedidos enviados"** (lê do status persistido, não de contador local).
- Para cada fornecedor da fila exibe `StatusEnvioBadge` (cinza/verde/amarelo/vermelho).
- Mantém avanço automático ao clicar "Abrir WhatsApp" — sem confirmação bloqueante.
- No `window.open(waUrl)`: dispara `registrarEnvio(acao=envio_inicial OU reenvio, status=enviado, origem=manual)` em paralelo (não bloqueia abertura do WhatsApp). Falha de rede mostra toast discreto mas mantém fluxo.
- Botão **Reenviar** sempre visível em cada item, independente do status. Reabre `buildWhatsAppUrl` regenerando a mensagem a partir dos dados atuais da cotação/preços (não usa cache de mensagem) e registra `acao=reenvio`.
- Toque no badge de status abre `HistoricoEnviosSheet`.

### 4.2 `StatusEnvioBadge` (`src/components/cotacao/StatusEnvioBadge.tsx`)
- 4 variantes via `statusMeta`. Mobile compacto (só dot + label curto), desktop completo.

### 4.3 `HistoricoEnviosSheet` (`src/components/cotacao/HistoricoEnviosSheet.tsx`)
- Sheet (mobile) / Dialog (≥md). Lista cronológica desc: ação, status resultante, origem, quem executou, timestamp formatado pt-BR. Badge "API" quando `origem=automatica`.

### 4.4 Telas que listam fornecedores da cotação
- `PedidosPage`, `DashboardPage` (fila), `AnalisePage > PedidosContent`: substituir indicadores ad-hoc pelo `StatusEnvioBadge`. Botão "Enviar Pedido" do `PedidosPage` passa a chamar `registrarEnvio`. Quando já enviado, rótulo muda para "Reenviar" mas continua disponível.

## 5. Preparação para API (sem implementar Twilio)
- RPC e tabela aceitam `origem=automatica` e `executado_por=null` já hoje.
- Edge function `webhook-envio-status` NÃO será criada agora — apenas documentada como ponto único de entrada que chamará `registrarEnvio` com `origem=automatica` e `metadata` do payload.
- Status `entregue`/`falhou` já renderizam corretamente quando aparecerem.

## 6. Testes (vitest)
- `envioStatus.test.ts` — labels/cores cobrem todos os 4 estados.
- `envioFornecedor.test.ts` — mock supabase: envio_inicial define `enviado_em`; reenvio NÃO sobrescreve `enviado_em` inicial mas insere nova linha de histórico; atualizacao_status muda só status.
- `SendQueueModal.status.test.tsx` — abrir WhatsApp marca enviado; botão Reenviar sempre habilitado; resumo "X de Y" lê do estado persistido.
- `HistoricoEnviosSheet.test.tsx` — renderiza linhas em ordem desc com badge correto por origem.

## 7. Responsividade
Validar manualmente 360px e desktop largo. Badge e botão Reenviar usam layout `flex-wrap gap-2`; sheet vira dialog em `md:`.

## 8. Não-objetivos
- Não alterar lógica de cálculo de pedido, ganhador, mínimo, conferência.
- Não criar integração Twilio.
- Não tocar em `cotacao_fornecedores.visualizado_em` (status do fornecedor, lado oposto).
