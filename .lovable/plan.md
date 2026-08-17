# Por que alguns clientes novos aparecem no plano Free

## O que eu verifiquei no banco

O teste grátis Business **não é criado no cadastro**. Ele é criado por um gatilho que só dispara quando o cliente **cria a primeira loja** (`trigger_create_trial_on_first_loja`). Quem se cadastra e abandona o onboarding antes de salvar a loja fica sem assinatura — e a função de plano devolve `free` como padrão.

Dados reais (últimos cadastros):

```text
pedrosantis4533@gmail.com     16/08  0 lojas  sem assinatura -> Free
catuchamatos@gmail.com        14/08  0 lojas  sem assinatura -> Free
emailtestejclx@gmail.com      23/07  0 lojas  sem assinatura -> Free
mariasnascimentomaria@...     22/07  0 lojas  sem assinatura -> Free
cristianoalveslobo83@...      12/08  1 loja   business/trialing -> OK
```

Todos os que criaram loja receberam `business/trialing` corretamente. Ou seja: não é bug de cobrança nem de leitura de plano — é o momento em que o trial é concedido.

Um efeito colateral: o controle anti-abuso (CNPJ) também só é gravado na criação da loja, então hoje o trial "espera" o CNPJ para ser liberado.

## Proposta de correção

1. **Conceder o trial de 30 dias no momento do cadastro**, junto da criação do perfil do usuário: assinatura Business com status `trialing`, 30 dias, sem exigir loja nem CNPJ.
2. **Manter o anti-abuso**, agora em duas camadas:
   - no cadastro, registrar o controle de trial pelo usuário (e telefone/fingerprint quando disponíveis);
   - quando a loja for criada com CNPJ, gravar o CNPJ no controle e, se aquele CNPJ já tiver usado trial antes, encerrar o trial recém-criado (vira Free) em vez de liberar 30 dias novos.
3. **Regularizar os cadastros já existentes sem assinatura**: conceder o trial de 30 dias a partir de agora para os clientes que se cadastraram e nunca tiveram assinatura (os 4 casos acima e similares), sem mexer em quem já tem assinatura ativa, em trial ou cancelada.

## Detalhes técnicos

- Migração ajustando `handle_new_user_profile` (ou gatilho novo em `auth.users`) para inserir em `subscriptions` (plano `business`, `trialing`, `current_period_end = now() + 30 dias`) e em `trial_controls`.
- Ajuste em `create_trial_subscription`: em vez de só criar o trial, passa a completar o CNPJ no `trial_controls` e a revogar o trial quando o CNPJ já foi usado por outro usuário.
- `get_user_plan` não muda.
- UPDATE/INSERT único de regularização dos usuários sem assinatura.
- Nenhuma mudança de frontend necessária; o banner de trial e os limites passam a refletir Business automaticamente.
