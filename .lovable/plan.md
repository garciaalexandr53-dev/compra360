# Inteligência de preço na cotação

Como você deixou a escolha comigo, vou pela melhoria de maior retorno por esforço e que não exige nenhum aprendizado novo do comprador: **mostrar a referência histórica de preço dentro da matriz de cotação**.

Hoje a matriz (`src/components/cotacao/TabelaCotacao.tsx`) só sabe comparar os preços daquela cotação entre si — a única inteligência existente é o alerta de anomalia (preço 80% acima da mediana). Não há nenhuma referência do que o supermercado já pagou antes. Ou seja: o comprador escolhe o menor preço da rodada, mesmo quando essa rodada inteira está caríssima em relação ao mês passado.

## O que o usuário vai ver

Na linha de cada produto, ao lado do nome, uma referência discreta:

```text
Arroz 5kg  ·  ref. R$ 24,90        (média das últimas cotações)
```

E em cada célula de preço preenchida, um sinal de variação:

- verde com seta para baixo: abaixo da referência (bom)
- neutro: dentro de ~3% da referência
- vermelho com seta para cima: acima da referência (atenção)

Tocando na referência abre um detalhe curto: último preço pago, melhor preço já obtido, quantas cotações compõem a média e a data da última.

No rodapé da análise, uma linha de resultado: **"Esta cotação está R$ X (Y%) abaixo/acima da sua média histórica"** — o número que justifica o sistema.

## Regras

- Referência = média dos preços vencedores do mesmo produto nas últimas 5 cotações fechadas da loja ativa.
- Menos de 2 cotações históricas: nada é exibido (degradação silenciosa, sem placeholder feio).
- Comparação sempre por preço unitário já convertido pelo fator de embalagem, para não comparar caixa com unidade.
- Somente leitura: nada disso altera preços, distribuição ou pedidos.

## Layout

- Mobile 360px: a referência entra como segunda linha do nome do produto, em texto pequeno; a variação na célula é só um ícone + percentual curto (ex. `-6%`), sem quebrar a largura mínima de 175px das colunas.
- Desktop: referência na mesma linha do nome; variação com ícone e percentual ao lado do valor.

## Detalhes técnicos

- Novo hook `src/hooks/useReferenciaPrecos.ts`: para os produtos da cotação atual, busca em lote os preços vencedores das últimas 5 cotações fechadas da loja e devolve um mapa `produto_id -> { media, ultimo, melhor, amostras, ultimaData }`. Uma query paginada com `fetchAllRows`, sem N+1.
- Novo utilitário puro `src/lib/referenciaPrecos.ts` com o cálculo (normalização por fator, média, classificação verde/neutro/vermelho) e testes em `referenciaPrecos.test.ts`.
- `TabelaCotacao.tsx` passa a consumir o mapa e renderizar os indicadores. Nenhuma mudança nas mutations de preço, no alerta de anomalia existente, nem na distribuição.
- Resumo de economia adicionado como bloco de leitura em `src/components/analise/ResumoContent.tsx`.

## Próximos passos sugeridos (não incluídos agora)

1. Curva ABC destacando os itens que concentram o gasto.
2. Cockpit de "próximo passo" no Painel, com ação de 1 toque.
3. Relatório mensal de economia consolidado no Histórico.
