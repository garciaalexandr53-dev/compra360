# Corrigir a economia estimada do Painel (R$ 42,27 vs R$ 490,19)

## O que está acontecendo

Confirmado no código: as três telas usam a mesma regra (média dos preços recebidos menos o preço vencedor), mas o Painel esquece o **fator de embalagem**.

- `src/pages/DashboardPage.tsx` (query `economy-estimate`, linhas ~371-391): multiplica só por `cp.quantidade`. Nem seleciona `fator_embalagem`.
- `src/pages/AnalisePage.tsx` (linhas 133-146, card "Economia vs média"): multiplica por `quantidade × fator_embalagem`.
- `src/pages/HistoricoPage.tsx` (Insights, linhas ~893-903): também `qtd × fator`.

Como a maioria dos itens é cotada em caixa/fardo (fator > 1), o Painel mostra um valor muito menor — exatamente o caso da imagem: R$ 42,27 no Painel contra R$ 490,19 nos Insights da mesma cotação.

## Correção

Na query `economy-estimate` do Painel:

1. Passar a selecionar `fator_embalagem` junto de `id, quantidade`.
2. Calcular `economia += (média − menor preço) × quantidade × (fator_embalagem || 1)`.

Com isso o card do Painel, o card "Economia vs média" da tela de análise/pedidos e o KPI dos Insights passam a mostrar o mesmo número para a mesma cotação.

## Detalhes técnicos

- Arquivo único alterado: `src/pages/DashboardPage.tsx`. Nenhuma mudança de banco, de texto de legenda ou de layout.
- O card histórico `economia-historica` (linhas 54-90) usa outra base (pior − melhor preço, sem fator) e alimenta os cards de trial; fora do escopo desta correção — sinalizo se quiser alinhar depois.

## Verificação

Comparar a mesma cotação nas duas telas (Painel → Ver pedidos prontos) e confirmar valores idênticos; conferir em 360px e desktop.
