# Alterar o e-mail de acesso de um cliente pelo Painel Admin

Nova ação na ficha do cliente que troca o e-mail de login, mantendo intactos lojas, produtos, cotações, histórico, pedidos e assinatura.

## Como vai funcionar na prática

1. No Painel Administrativo, abra o cliente (aba Clientes).
2. No rodapé da ficha aparece o botão **Alterar e-mail**.
3. O diálogo mostra o e-mail atual e pede:
   - o novo e-mail (duas vezes, para evitar erro de digitação);
   - a confirmação do e-mail atual, digitada por extenso (mesma proteção já usada na exclusão).
4. Há uma opção marcada por padrão: **atualizar também o e-mail no Stripe**, para que recibos e cobranças sigam chegando no endereço certo.
5. Ao confirmar, o e-mail é trocado imediatamente e já pode ser usado para entrar (sem precisar reconfirmar).
6. O sistema registra o contato/observação da alteração no histórico do cliente e a ficha é atualizada na tela.

Avisos exibidos no diálogo:
- A senha continua a mesma; só o endereço de login muda.
- O cliente perde o acesso pelo e-mail antigo.
- Nenhum dado é apagado.

Regras de segurança:
- Só administradores executam.
- Não permite trocar o e-mail de outra conta de administrador.
- Rejeita e-mail inválido ou já usado por outra conta, com mensagem clara.

## Detalhes técnicos

**Nova Edge Function `admin-change-user-email`** (espelha `admin-delete-user`):
- valida o JWT do chamador e exige papel `admin` em `user_roles`;
- valida `user_id` (UUID), `confirm_current_email` igual ao e-mail atual e `new_email` (formato + diferente do atual);
- bloqueia alvo com papel `admin`;
- verifica colisão via `admin.auth.admin.listUsers` filtrando por e-mail; retorna 409 se já existir;
- `admin.auth.admin.updateUserById(id, { email: novo, email_confirm: true })` — troca direta, sem fluxo de confirmação dupla;
- se `update_stripe` vier `true` e `STRIPE_SECRET_KEY` existir: busca o customer pelo e-mail antigo e atualiza `email` (falha aqui não desfaz a troca — retorna `stripe_updated: false` com o motivo);
- `console.log` de auditoria com admin e alvo; sem `verify_jwt` custom (validação em código).

**Frontend**
- `src/components/admin/AlterarEmailDialog.tsx` (novo): formulário, validações locais, `supabase.functions.invoke`, toasts pt-BR.
- `src/components/admin/ClienteDetalhesSheet.tsx`: botão **Alterar e-mail** no rodapé (grid mobile já existente, rótulo truncado) abrindo o diálogo.
- `src/pages/AdminPage.tsx`: ao sucesso, invalidar `admin-clientes`, `admin-cliente-detalhes` e `admin-cliente-pagamentos`.
- Registro no histórico via RPC existente `admin_registrar_contato` (canal `email`, motivo `manual`, observação "E-mail alterado de X para Y").

**Sem alteração de schema.** Nenhuma migração, RLS ou tabela nova — `auth.users` é atualizado apenas pela função com service role.

## Validação
- `tsgo` + suíte de testes.
- Verificação no navegador (desktop e 360px) de que o botão e o diálogo aparecem sem corte no rodapé da ficha.
