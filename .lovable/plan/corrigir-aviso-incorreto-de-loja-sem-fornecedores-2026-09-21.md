# Corrigir aviso incorreto de loja sem fornecedores

## O que foi verificado
- A conta tem apenas **1 loja** e **1 fornecedor** cadastrado.
- Antes de você marcar a loja, o fornecedor estava sem nenhuma loja marcada e o aviso continuou aparecendo.
- A correção que trata "fornecedor sem loja marcada = atende todas as lojas" já está no código, mas ainda não foi para o ar; por isso o app no celular seguia com o comportamento antigo.

## Resposta à sua dúvida
Com apenas uma loja cadastrada, não deveria ser preciso marcar nada: se existe fornecedor na conta, ele atende essa única loja. Vamos deixar essa regra explícita.

## Alterações
1. Contar como disponíveis os fornecedores marcados para a loja ativa **e** os que não têm nenhuma loja marcada.
2. Regra extra: quando a conta tem apenas uma loja, todo fornecedor cadastrado conta como disponível.
3. Atualizar a contagem na hora após cadastrar, editar, excluir ou importar fornecedor, e recarregar ao voltar ao painel (sem número antigo preso na tela).
4. Manter o aviso apenas quando a loja realmente não tiver nenhum fornecedor disponível.
5. Publicar a atualização para o app do celular carregar a versão corrigida.

## Validação
- Loja única com 1 fornecedor sem loja marcada: o aviso não deve aparecer.
- Cadastrar o primeiro fornecedor, excluir o último e alternar entre lojas (quando houver mais de uma).
- Verificações automatizadas verdes antes de publicar.
