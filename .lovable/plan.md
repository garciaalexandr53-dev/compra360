# Corrigir o "Responda este e-mail" do e-mail de boas-vindas

## O que está acontecendo (verificado)

- O e-mail de boas-vindas termina com "Precisa de ajuda? Responda este e-mail que nossa equipe vai te atender." (`welcome.tsx`).
- Mas o remetente é `noreply@notify.compra360app.com.br`, uma caixa de envio apenas: ela não recebe mensagens. Por isso o cliente que responde recebe de volta a falha de entrega ("Falha na entrega aos seguintes destinatários ou grupos").

## Mudança proposta

Trocar a instrução por um caminho de atendimento que realmente funciona: o WhatsApp de suporte que já usamos no site e no app (44 98448-3553).

Novo texto no rodapé do e-mail de boas-vindas:

```text
Precisa de ajuda? Fale com a nossa equipe no WhatsApp.
(esta caixa de e-mail não recebe respostas)
```

- "WhatsApp" fica como link clicável para a conversa já pré-preenchida com uma mensagem de ajuda.
- O aviso de que a caixa não recebe respostas evita que alguém tente responder e receba erro.
- Layout, cores, logo e botão "Acessar o painel" permanecem exatamente como estão.

## Detalhes técnicos

- `supabase/functions/_shared/transactional-email-templates/welcome.tsx`: substituir o texto do rodapé por texto + `Link` para `https://api.whatsapp.com/send?phone=5544984483553&text=...` (mesmo número/mensagem de `src/lib/suporte.ts`), mantendo os estilos atuais.
- Nenhum outro template contém "Responda este e-mail" (verificado); nada mais é alterado.
- Redeploy da função `send-transactional-email` após a edição.
- Verificação: renderizar a prévia do template de boas-vindas e conferir o link, além do typecheck/testes existentes.

## Observação

Se preferir permitir respostas de verdade por e-mail, isso exigiria uma caixa que receba mensagens (por exemplo `contato@compra360app.com.br`) configurada como endereço de resposta — posso planejar isso depois se quiser.
