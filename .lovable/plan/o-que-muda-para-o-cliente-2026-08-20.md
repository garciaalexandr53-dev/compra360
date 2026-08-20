Canal de suporte por WhatsApp para todos os planos

Decisão: por enquanto o suporte será por WhatsApp, disponível em todos os planos (inclusive o Free). O chat em-app com histórico fica para quando a carteira de clientes crescer.

## O que muda para o cliente

1. Botão flutuante "Ajuda" no app (canto inferior direito, acima do menu inferior no mobile).
   - Visível para qualquer usuário logado, independente do plano.
   - Abre o WhatsApp do suporte com mensagem pré-preenchida contendo nome da loja, e-mail e plano atual — assim você já sabe quem está falando antes de responder.
   - Respeita a safe-area do iPhone e não sobrepõe o `BottomNav`.

2. Link de suporte no rodapé da landing page ("Falar com o suporte") e no FAQ.
   - Nova pergunta no FAQ: "Como falo com o suporte?" com resposta explicando que é por WhatsApp, em todos os planos.

3. Item "Ajuda / Suporte" no menu lateral (grupo "Mais") e no rodapé de "Meus dados", para quem preferir procurar pelo menu em vez do botão flutuante.

## Textos dos planos

Todos os planos passam a mostrar suporte, com diferenciação honesta de prioridade:

- Gratuito: "Suporte por WhatsApp"
- Pro: "Suporte por WhatsApp" (mantém)
- Business: "Suporte prioritário por WhatsApp" (resposta na frente da fila)

Aplicado nos dois lugares onde os planos aparecem: a landing page e o modal de planos dentro do app.

## Onde fica o número

O número do WhatsApp de suporte é **44 98448-3553**.

## Onde fica o número

Um único arquivo `src/lib/suporte.ts` guarda:
- o número de WhatsApp do suporte (44 98448-3553);
- o helper que monta a URL com a mensagem pré-preenchida (reaproveitando `buildWhatsAppUrl` de `src/lib/format.ts`, que já existe);
- o texto padrão da mensagem.

Assim, trocar o número no futuro é uma edição em um lugar só.


## Detalhes técnicos

- Novo `src/lib/suporte.ts` com `SUPORTE_WHATSAPP` e `buildSuporteUrl({ nome, email, plano })`.
- Novo `src/components/SuporteFlutuante.tsx`, montado no `AppLayout` junto ao `BottomNav`. Usa `useProfile` e `useSubscription` (já existentes) para compor a mensagem.
- `src/pages/LandingPage.tsx`: adiciona a feature de suporte no plano Gratuito, ajusta o texto do Business, novo item no FAQ e link no rodapé.
- `src/components/PlanosModal.tsx`: mesmas alterações de texto.
- `src/components/AppSidebar.tsx`: item "Ajuda" no grupo "Mais" abrindo o WhatsApp em nova aba.
- Nenhuma tabela nova, nenhuma Edge Function, nenhuma migração — o WhatsApp é um link externo.
- Teste unitário para `buildSuporteUrl` (número normalizado, mensagem codificada, campos ausentes tratados).
- Build verde. Verificação visual em 360px e desktop.

## Observações

- Não altera a página de perfil, nem cobra cadastro de WhatsApp — quem clicar em "Ajuda" já sai com o número do suporte na mão.
- Build verde. Verificação visual em 360px e desktop.

