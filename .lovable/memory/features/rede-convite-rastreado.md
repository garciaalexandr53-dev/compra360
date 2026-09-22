---
name: Convite rastreado da Rede
description: Link de convite com ?c=<loja_id> vincula o fornecedor autocadastrado à loja que convidou
type: feature
---
- `linkConviteRede(lojaId)` em `src/lib/conviteRede.ts` gera `https://compra360app.com.br/rede?c=<loja_id>`.
- `/rede` e `SejaParceiroPage` repassam a query até `/seja-parceiro/cadastro`.
- `CadastroParceiroPage` valida o UUID e envia `_convite_loja` para `cadastrar_fornecedor_parceiro`.
- A RPC define `fornecedores.user_id` = dono da loja, grava `convite_loja_id` e cria o vínculo em `fornecedor_lojas`, mantendo `consentimento_rede = 'sim'` e `origem_cadastro = 'autocadastro'`.
- Prévia da mensagem no diálogo renderiza `*negrito*` formatado e o link como clicável.
