# Ícone do app Funcionários no iPhone já abrir na loja certa

## Problema
No iPhone, o ícone da Tela de Início é criado a partir do endereço inicial do app, que hoje é sempre `/reposicao` (sem a loja). Por isso o ícone abre sem saber a loja e mostra "Abra pelo link da sua loja", mesmo depois de o colaborador ter aberto pelo link.

## O que muda

1. **Ícone já nasce com a loja (opção 2)**
   - Quando o app é aberto por `/reposicao?loja=<id>`, a página passa a informar ao iPhone/Android um endereço inicial com a própria loja (`/reposicao?loja=<id>`).
   - Ao tocar em "Adicionar à Tela de Início", o ícone salva esse endereço completo e passa a abrir direto na loja, todos os dias.
   - Sem `?loja=` no endereço, tudo continua como hoje.

2. **Link enviado pelo WhatsApp (tela Funcionários do gestor)**
   - Manter o link no formato atual (`https://compra360app.com.br/reposicao?loja=<id>`), sempre com o domínio oficial.
   - Melhorar a mensagem pronta do WhatsApp com o passo a passo curto de instalação:
     - iPhone: "Toque no link → se abrir dentro do WhatsApp, escolha Abrir no Safari → Compartilhar → Adicionar à Tela de Início".
     - Android: "Toque no link → menu (3 pontinhos) → Instalar aplicativo / Adicionar à tela inicial".
   - Aviso na mensagem: "Se já tinha o ícone antigo, apague e instale de novo por este link."

3. **Tela "Abra pelo link da sua loja"**
   - Texto atualizado: orientar a apagar o ícone e instalar novamente a partir do link recebido no WhatsApp.
   - Botão de suporte no WhatsApp (44 98448-3553) mantido/adicionado discretamente.

## Para o colaborador que já tem o ícone
Depois da publicação: apagar o ícone atual, abrir o link da loja no Safari e adicionar à Tela de Início de novo. Um ícone antigo não se atualiza sozinho (limitação da Apple).

## Fora de escopo
- Sem mudança na trava de segurança, nas consultas da loja, no envio de itens ou na conferência.
- Sem botão "Colar link" (descartado a pedido).

## Detalhes técnicos
- `index.html` (script inicial): se a rota for `/reposicao` com `loja`, gerar um manifest dinâmico (Blob URL) a partir de `manifest-funcionarios.json` com `start_url` e `id` = `/reposicao?loja=<id>` e `scope` `/reposicao`; ícones com URLs absolutas (`location.origin`). Fallback para o arquivo estático.
- iOS usa a URL atual da página ao adicionar à Tela de Início; garantir que `?loja=` permanece na barra (o app já reinsere o parâmetro via `history.replaceState`) e remover `__lovable_token` não interfere.
- `FuncionariosPage.tsx`: ajustar só o texto da mensagem do WhatsApp (função que monta a mensagem), sem mudar a geração do link.
- `AppFuncionariosPublic.tsx`: apenas texto da tela sem loja.
- Verificação: tsgo + vitest verdes; Playwright confirmando que `/reposicao?loja=<id>` expõe manifest com `start_url` contendo a loja. Publicar em seguida (build verde).
