# Corrigir aviso incorreto de loja sem fornecedores

## Diagnóstico confirmado
- A loja ativa tem **1 fornecedor cadastrado**.
- Esse fornecedor não está limitado a uma loja específica, portanto deve ser considerado disponível para a loja ativa.
- O aviso ainda pode permanecer por causa de uma contagem antiga mantida na tela, mesmo após o cadastro.

## Alteração
1. Fazer o aviso usar a mesma lista de fornecedores disponíveis usada na criação da cotação: vinculados à loja ativa **ou** sem vínculo específico.
2. Atualizar essa contagem imediatamente após cadastrar, editar, excluir ou importar um fornecedor.
3. Garantir nova consulta ao abrir ou retornar ao painel, evitando que o valor antigo permaneça no celular.
4. Manter o aviso somente quando a loja realmente tiver zero fornecedores disponíveis.

## Validação
- Testar com a loja atual e o fornecedor já cadastrado: o aviso deve desaparecer.
- Testar cadastro de um primeiro fornecedor, exclusão do último e troca entre lojas.
- Executar as verificações automatizadas antes de disponibilizar a correção.
