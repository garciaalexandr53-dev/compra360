# Inteligência de Preço na Cotação (opção 2: só o Último Preço na tela)

## O que o comprador vai ver
- **Abaixo do nome do produto**, uma linha pequena e discreta: `Último: R$ 22,90 · Atacadão · 12/09`. Nenhuma coluna nova.
- **Nas células de preço dos fornecedores**: uma setinha pequena ao lado do valor.
  - Verde ↓ quando está mais de 3% abaixo do último preço pago.
  - Vermelha ↑ quando está mais de 3% acima.
  - Sem seta quando está dentro de ±3%.
- **Ao tocar no preço (ou passar o mouse no computador)**: um balão com o detalhe:
  - Último preço pago, fornecedor e data
  - Média das últimas cotações (e quantas cotações entraram nela)
  - A diferença em % contra o último preço e contra a média
- **Tela de Resumo/Pedidos**: uma linha a mais: "Comparado ao último preço pago: economia de R$ X (−Y%)" ou "R$ X acima (+Y%)".
- Se o item não tiver pelo menos 2 compras anteriores na loja, nada aparece para ele.

## Regras
- Considera as últimas 5 cotações finalizadas da mesma loja que viraram pedido.
- Em cada uma, usa o preço vencedor (o menor) daquele item.
- O produto é reconhecido pelo Catálogo Mestre, pelo EAN ou pelo nome padronizado.
- A comparação usa o preço por unidade (preço ÷ fator da embalagem), assim "caixa com 12" e "unidade" ficam comparáveis.
- Só mostra informação e nunca bloqueia nada.

## Por plano
- **Pro e Business**: tudo liberado.
- **Free**: no lugar da linha "Último", aparece o selo discreto "Inteligência de Preço · Pro". Tocar no selo abre a tela de planos. Sem setas e sem balão.

## Detalhes técnicos
- Nova RPC `get_historico_precos_loja(_loja_id uuid)`, SECURITY DEFINER, `SET search_path = public`. Exige `auth.uid()` e confere se é dono da loja (`lojas.user_id = auth.uid()`). Retorna, por chave de produto (catalogo_mestre_id / ean / nome normalizado): último preço unitário, fornecedor, data, média unitária e número de amostras (só quando há 2 ou mais).
- Novo helper puro `src/lib/precoHistorico.ts` com normalização da chave, cálculo da variação e classificação (tolerância de 3%), mais testes vitest.
- Novo hook `useHistoricoPrecos(lojaId)` com React Query (staleTime de 5 min).
- `CotacaoPage.tsx` passa o mapa para `TabelaCotacao.tsx`. Ali entram a linha "Último" abaixo do nome, a seta nas células e um Popover/Tooltip com o detalhe. No Free entra o selo, usando `useSubscription`/`isPro` e o `PlanosModal`.
- `ResumoPage.tsx` / `ResumoContent.tsx` ganham a linha de comparação com o último preço pago.
- Nenhuma query ou mutação existente é alterada. AddItemDialog não é tocado.
- A validação é feita com tsgo + vitest verdes antes de publicar.
