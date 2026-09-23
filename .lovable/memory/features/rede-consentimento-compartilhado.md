---
name: Consentimento da Rede compartilhado
description: Onboarding do fornecedor (consentimento, CNPJ, pasta, cidades) é compartilhado entre clientes pelo WhatsApp (últimos 8 dígitos) ou CNPJ
type: feature
---

Problema original: cada cliente tem um registro próprio em `fornecedores` com token próprio,
então o mesmo representante (ex.: Elvis / DESTRINHO 44 99732-7891) recebia a pergunta de
consentimento e CNPJ em cotações de clientes diferentes.

Solução (migração de 23/09/2026):
- `fornecedor_fone_key(telefone)` → últimos 8 dígitos; `fornecedor_cnpj_key(cnpj)` → 14 dígitos.
- `fornecedor_grupo_ids(_id)` (SECURITY DEFINER, EXECUTE revogado de anon/authenticated/PUBLIC)
  retorna todos os cadastros do mesmo fornecedor por telefone OU CNPJ.
- `get_supplier_onboarding_state(_token,_cotacao_id)` agrega o grupo:
  qualquer `consentimento_rede='sim'` no grupo ⇒ `pedir_consentimento=false` e `participa_rede=true`;
  CNPJ, pasta, tipo_fornecedor e cidades vêm do grupo (união das cidades).
- `salvar_dados_fornecedor` propaga consentimento, CNPJ, pasta e cidades para todos os ids do grupo
  (inclui no grupo quem já tinha o CNPJ recém-informado).
- Reconciliação retroativa aplicada: todos os grupos com um "sim" ficaram "sim", com CNPJ,
  pasta e cidades replicados.

Regra: a chave mestra de identidade do fornecedor é o WhatsApp do representante; o CNPJ é secundário.
