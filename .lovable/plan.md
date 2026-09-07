# Aviso "205 pedido(s) aguardando confirmação" no Painel

## O que essa informação é hoje

O aviso conta **todos os pedidos já enviados a fornecedores que nunca foram marcados como recebidos** — desde março de 2026, de **todas as lojas** e de **todas as cotações antigas**, não apenas da cotação atual.

Confirmado no banco:

- 223 pedidos com situação "enviado", espalhados por 31 cotações e 7 lojas, entre 16/03/2026 e 26/08/2026.
- Apenas 2 pedidos em toda a base foram marcados como "recebido".

Ou seja: o número cresce para sempre, porque na prática ninguém fecha o ciclo marcando o pedido como recebido. Não é um pendente real de hoje.

## Por que o clique abre a Análise

O aviso foi programado para levar à tela de Análise. Mas a Análise só trabalha com a **cotação ativa** — ela carrega os itens e preços da cotação em aberto. Como o aviso fala de pedidos de cotações antigas já finalizadas, a tela abre sem nada para analisar. O destino está simplesmente errado para o conteúdo do aviso.

## O que fazer

1. **Limitar o aviso ao que é atual e da loja selecionada**: contar somente pedidos enviados da loja ativa e dos últimos 30 dias, ignorando o histórico antigo. Se não houver nada nesse recorte, o aviso desaparece.
2. **Corrigir o destino do clique**: em vez da Análise, levar para a tela de Pedidos da cotação correspondente, onde é possível ver os pedidos enviados e acompanhá-los.
3. **Deixar o texto mais claro**: "X pedido(s) enviados nos últimos 30 dias aguardando recebimento" em lugar de "aguardando confirmação".

Se preferir, o aviso pode ser simplesmente removido do Painel — ele só faz sentido se o recebimento passar a ser marcado com regularidade.

## Observação importante

O acúmulo dos 223 pedidos antigos permanece no banco. Nada será apagado. Se quiser, em uma etapa seguinte podemos oferecer no painel administrativo uma forma de encerrar em bloco os pedidos antigos, para o histórico ficar coerente.

## Detalhes técnicos

- `src/pages/DashboardPage.tsx` (~linha 307): query `pedidos-pendentes` sem filtro de `loja_id` nem de data; adicionar `.eq("loja_id", lojaAtiva.id)` e `.gte("enviado_at", now-30d)`, incluindo `lojaAtiva?.id` na `queryKey`.
- `src/pages/DashboardPage.tsx` (~linha 765): trocar `navigate("/analise")` por navegação para `/pedidos` (a rota de gestão de pedidos) e ajustar o texto.
- `src/components/dashboard/DashboardAlerts.tsx` tem o mesmo botão duplicado (mesmo texto e mesmo `navigate("/analise")`); alinhar ou remover se estiver sem uso.
- Nenhuma alteração de banco, RLS ou Edge Function.
