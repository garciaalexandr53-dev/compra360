# Trocar "Responda este e-mail" por WhatsApp e destacar o WhatsApp na landing

## Contexto (estado atual verificado)
- O **e-mail de boas-vindas automático** (`supabase/functions/_shared/transactional-email-templates/welcome.tsx`) já usa o link de WhatsApp da equipe no rodapé. **Não será alterado.**
- A **landing** já tem um link "Falar com o suporte" (WhatsApp `5544984483553`) no rodapé, discreto.
- Os únicos textos "Responda este e-mail" estão nos **e-mails de prospecção do admin** em `src/lib/adminHelpers.ts`, nos casos `boas_vindas` e `trial_7d`. São enviados pelo `ContatoModal` via template transacional `notification`, que renderiza a mensagem como texto puro.

## Escopo
1. Substituir o convite "responda este e-mail" pelo link de WhatsApp da equipe nos dois e-mails de prospecção afetados.
2. Destacar o WhatsApp na landing com um botão flutuante de alta visibilidade, mantendo o link do rodapé.

## Alterações

### 1) `src/lib/adminHelpers.ts`
- Importar `SUPORTE_WHATSAPP` de `@/lib/suporte` e adicionar constante:
  ```ts
  const WHATSAPP_SUPORTE_URL = `https://wa.me/55${SUPORTE_WHATSAPP}`;
  ```
- Caso `boas_vindas` (campo `email`): trocar
  `Me chama no WhatsApp ou responde este email quando puder.`
  por
  `Para qualquer dúvida, me chame no WhatsApp: ${WHATSAPP_SUPORTE_URL}` (mantém a assinatura do Alexandre).
- Caso `trial_7d` (campo `email`): trocar
  `Responda este email ou me chame no WhatsApp.`
  por
  `Me chame no WhatsApp para definir o plano ideal: ${WHATSAPP_SUPORTE_URL}` (mantém a assinatura do Alexandre).
- Demais casos (`sem_uso_7d`, `inativo_15d`, `trial_3d`) não mencionam "responda este e-mail" e permanecem inalterados.

### 2) `src/pages/LandingPage.tsx`
- Adicionar um **botão flutuante de WhatsApp** fixo no canto inferior direito, visível em todas as resoluções (mobile 360px e desktop):
  - Link: `https://wa.me/5544984483553?text=` + mensagem codificada ("Olá! Quero saber mais sobre o Compra360.").
  - Visual: círculo verde (`bg-[#25D366]`), ícone SVG do WhatsApp, sombra suave, `aria-label="Falar com o suporte pelo WhatsApp"`, `rel="noopener noreferrer"`, abre em nova aba.
  - Offsets com `safe-area-inset` no mobile para não sobrepor o conteúdo.
  - Animação de hover discreta (escala) e `z-index` alto.
- O link "Falar com o suporte" do rodapé permanece.

## Não incluído
- E-mail de boas-vindas automático (já usa WhatsApp).
- Nenhum dado, tabela, RLS ou regra de negócio é alterado.
- Não há Edge Functions para republicar (a mudança é só nos corpos de texto do admin e no front da landing).

## Validação
- `tsgo` typecheck.
- Suíte de testes (`adminHelpers.test.ts` não afirma sobre o trecho alterado; adicionar/ajustar não é necessário, mas os testes atuais devem continuar verdes).
- Verificação visual via Playwright em desktop e 360px: botão flutuante visível e clicável na landing, sem sobrepor o CTA principal.
