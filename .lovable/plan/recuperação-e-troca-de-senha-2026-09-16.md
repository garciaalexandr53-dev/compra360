# Recuperação e troca de senha

Hoje existem duas lacunas: na tela de entrada não há link "Esqueci minha senha", e não existe uma página para o cliente digitar a nova senha depois de clicar no link do e-mail (hoje o link só leva para a tela de entrada). E quando o cliente não tem mais acesso ao e-mail, não há nenhuma saída pelo painel.

O plano cobre os dois caminhos.

## 1. Cliente com acesso ao e-mail (autoatendimento)

- Na tela de entrada aparece o link **Esqueci minha senha**. O cliente informa o e-mail e recebe um e-mail com link seguro.
- Nova página **Definir nova senha**: o link do e-mail abre direto nela, o cliente digita a nova senha duas vezes e já entra na plataforma.
- Em **Meu perfil**, o botão de redefinir senha passa a apontar para essa mesma página (hoje ele joga o cliente na tela de entrada).
- Mensagens em português, incluindo o caso de link expirado (com opção de pedir um novo).

## 2. Cliente sem acesso ao e-mail (via Painel Administrativo)

Na ficha do cliente, ao lado de "Alterar e-mail", entram duas ações:

- **Enviar link de redefinição** — dispara o e-mail de redefinição para o e-mail cadastrado. Útil quando o cliente só não achou o e-mail.
- **Definir senha temporária** — o administrador define (ou gera automaticamente) uma senha provisória, copia e passa ao cliente pelo WhatsApp. O cliente entra com ela e troca em "Meu perfil".

Proteções, iguais às já usadas nas outras ações sensíveis:

- Só administradores executam.
- Não é possível alterar a senha de outra conta de administrador.
- Pede confirmação digitando o e-mail atual do cliente por extenso.
- Senha mínima de 8 caracteres; o gerador cria uma senha forte.
- Cada ação fica registrada no histórico do cliente ("Senha temporária definida pelo suporte" / "Link de redefinição enviado").
- A senha nunca é exibida depois de fechar o diálogo — o administrador copia na hora.

Nenhum dado do cliente é apagado ou movido: lojas, produtos, cotações, histórico, pedidos e assinatura continuam intactos.

Se o cliente também perdeu o acesso ao e-mail de forma definitiva, o caminho recomendado é: primeiro **Alterar e-mail** (já existe), depois **Enviar link de redefinição** para o novo endereço.

## Detalhes técnicos

- Rota pública `/reset-password` (nova página `ResetPasswordPage.tsx`), fora do bloco autenticado, tratando o hash `type=recovery` e chamando `supabase.auth.updateUser({ password })`.
- `LoginPage.tsx`: link "Esqueci minha senha" + `resetPasswordForEmail(email, { redirectTo: ${origin}/reset-password })`.
- `PerfilPage.tsx`: ajustar `redirectTo` para `/reset-password`. A troca de senha pelo próprio usuário logado envia `current_password` junto do `updateUser`.
- Nova Edge Function `admin-set-user-password`: valida JWT + papel admin em `user_roles`, valida `user_id`, `confirm_current_email` e a força da senha, bloqueia alvo admin, aplica `auth.admin.updateUserById({ password })`, log de auditoria. Para o envio de link, usa `resetPasswordForEmail` no cliente admin com `redirectTo` da app.
- Novo `src/components/admin/SenhaClienteDialog.tsx` com as duas ações; `ClienteDetalhesSheet.tsx` ganha o botão **Senha** no rodapé (mesmo grid mobile).
- Registro no histórico via RPC `admin_registrar_contato` (canal `email`, motivo `manual`), invalidando `admin-contatos-cliente`.
- Sem mudança de schema: nenhuma migração, RLS ou tabela nova.
- Validação: `tsgo`, suíte de testes e verificação no navegador em desktop e 360px.
