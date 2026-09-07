# Confirmação de e-mail em português e login obrigatório após confirmar

## O que está acontecendo hoje (verificado)

- O assunto do e-mail de confirmação está em inglês: no `auth-email-hook` os assuntos estão como "Confirm your email", "Reset your password", etc. (o corpo do e-mail já está em português).
- Ao clicar em "Confirmar email", o link já cria a sessão e leva direto ao painel, porque o cadastro envia o retorno para a própria área logada (`emailRedirectTo` aponta para a página de destino do login).
- O e-mail de boas-vindas é disparado no momento do cadastro (em `useAuth.signUp`), antes de qualquer confirmação — por isso chega junto com o e-mail de confirmação.

## Mudanças propostas

### 1. Assuntos dos e-mails em português

Traduzir os assuntos no `auth-email-hook`:

```text
Confirme seu e-mail
Você recebeu um convite
Seu link de acesso
Redefinir sua senha
Confirme seu novo e-mail
Seu código de verificação
```

### 2. Confirmar o e-mail e depois pedir login

- O link do e-mail passa a voltar para uma página nova de confirmação (`/email-confirmado`), em vez de entrar direto no painel.
- Nessa página: valida a confirmação, encerra a sessão criada pelo link e mostra a mensagem "E-mail confirmado! Agora entre com seu e-mail e senha", com botão para a tela de login.
- Resultado: o cliente confirma, e só entra informando e-mail e senha — como você pediu.

### 3. Boas-vindas só depois da confirmação

- Retirar o envio de boas-vindas do momento do cadastro.
- Passar a enviar quando o e-mail já estiver confirmado, no primeiro acesso confirmado da conta, mantendo a chave de idempotência (`welcome-<id>`) para nunca duplicar.
- Assim, quem não confirmar nunca recebe boas-vindas.

### 4. Navegador ao clicar no link (Copilot/Edge, Chrome, iOS)

Isso não é controlável pelo sistema: o link do e-mail abre sempre no navegador padrão do aparelho (no seu caso o app de e-mail estava abrindo no navegador embutido da Microsoft). Não existe forma de forçar o Chrome a partir do e-mail, nem no Android nem no iOS. O que faremos é garantir que a página de confirmação funcione bem em qualquer navegador embutido: ela é simples, sem depender de sessão anterior, e mostra botão "Entrar" que funciona em Chrome, Safari e navegadores internos. Se quiser, você pode definir o Chrome como navegador padrão do celular para que os links sempre abram nele.

## Detalhes técnicos

- `supabase/functions/auth-email-hook/index.ts`: traduzir `EMAIL_SUBJECTS`; redeploy da função.
- `src/pages/LoginPage.tsx`: `emailRedirectTo` passa a ser `${window.location.origin}/email-confirmado`.
- Nova página `src/pages/EmailConfirmadoPage.tsx` + rota pública em `src/App.tsx`: chama `supabase.auth.signOut()`, exibe confirmação e link para `/login`.
- `src/hooks/useAuth.tsx`: remover o envio de `welcome` do `signUp`; enviar no `onAuthStateChange` quando `user.email_confirmed_at` existir e a flag local da conta ainda não tiver sido marcada (idempotência mantida no servidor).
- Sem alterações de banco, RLS ou fluxo de cotações. Verificação: typecheck, testes existentes e conferência visual em 360px e desktop.
