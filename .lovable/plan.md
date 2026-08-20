Chat de suporte prioritário em-app (Pro/Business)

Objetivo: transformar o item "Suporte prioritário" em um canal real dentro do app, com histórico de conversas, fácil para o cliente e gerenciável pelo administrador.

O que será entregue:

```text
Cliente (Pro/Business)              Supabase                  Admin
        |                              |                       |
        |-- Abre chat flutuante ------>|                       |
        |-- Envia mensagem ---------->|-- RLS: só suas msgs   |
        |                              |-- Notifica por email  |--> Aba "Suporte"
        |                              |                       |--> Responde
        |<-- Vê resposta em tempo real |<----------------------|
```

Escopo:  
- Vai substituir os textos "Suporte prioritário" e "Suporte por WhatsApp" por "Chat de suporte em-app" (landing page e modal de planos).  
- Apenas clientes Pro e Business veem o botão de chat.  
- Free fica sem chat (mantém o link para WhatsApp apenas se já existir, mas não vamos adicionar nada novo).  
- Admin ganha uma aba "Suporte" no `/admin` para ler e responder.

Tabelas no Lovable Cloud:

1. `support_tickets` (uma conversa por cliente)
   - `id` uuid PK
   - `user_id` uuid → `auth.users(id)`
   - `status` text: `aberto` | `respondido` | `resolvido` | `arquivado`
   - `subject` text (opcional, resumo da primeira mensagem)
   - `created_at`, `updated_at` timestamptz
   - `GRANT` para `authenticated` e `service_role`; RLS ativo.

2. `support_messages` (histórico de mensagens)
   - `id` uuid PK
   - `ticket_id` uuid → `support_tickets(id)`
   - `sender_type` text: `cliente` | `admin`
   - `message` text
   - `created_at` timestamptz
   - `GRANT` para `authenticated` e `service_role`; RLS ativo.

Políticas RLS:
- Usuário comum pode SELECT/INSERT apenas em tickets/mensagens onde `user_id = auth.uid()`.
- Admin (`public.has_role(auth.uid(), 'admin')`) pode SELECT/UPDATE/INSERT em todos.
- UPDATE de `status` apenas admin.

Frontend:

1. Novo componente `src/components/support/SupportChat.tsx`:
   - Botão flutuante com ícone de chat no `AppLayout` (aparece só para Pro/Business).
   - Janela expansível com lista de mensagens, campo de texto e botão enviar.
   - Marca mensagens do admin à direita, do cliente à esquerda.
   - Usa Supabase Realtime para atualizar novas respostas sem reload.
   - Mobile: drawer/barra inferior adaptável; desktop: bubble lateral.

2. Hook `src/hooks/useSupportTickets.ts`:
   - Carrega o ticket aberto do usuário logado (ou cria um novo na primeira mensagem).
   - Expõe `sendMessage`, `messages`, `isLoading`, `unreadCount`.

3. Atualização de textos:
   - `src/pages/LandingPage.tsx`: Pro vira "Chat de suporte em-app"; Business vira "Suporte prioritário via chat".
   - `src/components/PlanosModal.tsx`: Pro e Business usam a mesma nomenclatura.

4. Aba "Suporte" no admin:
   - Novo componente `src/components/admin/SuporteTab.tsx`.
   - Lista tickets ordenados por `updated_at` desc.
   - Filtros rápidos: `abertos`, `respondidos`, `resolvidos`.
   - Ao clicar, abre o ticket com campo de resposta.
   - Botão para marcar como resolvido/arquivado.
   - Badge com contagem de não respondidos.

Backend:

1. Edge Function `notify-support`:
   - Disparada por trigger (ou insert via function) quando uma mensagem de cliente é inserida.
   - Envia email transacional para o administrador (usando `send-transactional-email` ou a fila de email já existente) com resumo e link para o admin.
   - Não expõe nada para o cliente.

2. Migration:
   - Cria tabelas, índices (`support_tickets.user_id`, `support_messages.ticket_id`), políticas RLS e GRANTs.
   - Garante `SET search_path = public` em funções SECURITY DEFINER se necessário.

Segurança e limites:
- Limite de 500 caracteres por mensagem.
- Rate limit simples: máximo 1 mensagem a cada 3 segundos por usuário (validado no client + server).
- Admin não pode se passar por cliente; `sender_type` é sempre `admin` nas respostas do admin.
- Sem anexos no MVP.

Testes e verificação:
- Testes unitários para o hook de tickets e o componente de mensagens.
- Verificação de RLS: usuário A não vê tickets do usuário B.
- Teste de envio de email no sandbox (mock).
- Build verde.
- Mobile 360px e desktop 1280px.

Não incluído neste plano:
- Notificações push.
- Upload de imagens/anexos.
- Chat com IA automática.
- Múltiplos atendentes/filas.
