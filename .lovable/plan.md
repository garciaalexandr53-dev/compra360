# Remover o aviso "produtos precisam reposição urgente" do Painel

## Esclarecimento

O aviso que retiramos antes foi outro: "X pedido(s) aguardando confirmação", que levava para a tela de Análise. Esse já não existe mais.

O bloco laranja da imagem — "10 produto(s) precisam reposição urgente" — é um segundo aviso, diferente, que continua ativo no Painel. Ele calcula, a partir das últimas 10 cotações finalizadas da loja, o intervalo médio entre compras de cada produto e sinaliza os que passaram (urgente) ou estão perto (próximo) da data prevista de recompra. Nunca foi removido.

## Alteração proposta

Retirar esse aviso do Painel:

1. `src/pages/DashboardPage.tsx` — remover a linha que exibe o bloco de reposição e o import correspondente.
2. `src/components/dashboard/DashboardReposicao.tsx` — excluir o arquivo, já que deixa de ser usado (é o único ponto que o utiliza).

## Não muda

- Nenhuma alteração no banco, em permissões ou em funções do backend.
- Cotações, pedidos e o alerta de itens faltantes continuam iguais.

## Validação

- Typecheck verde.
- Conferir no preview (desktop e 360px) que o bloco laranja não aparece mais e o restante do Painel segue íntegro.
