# OCR NF: unidade de medida, conversão e contagem única

Hoje o OCR lê "quantidade" e "preço unitário" da nota sem saber se aquilo é por **unidade** ou por **embalagem** (caixa, fardo, dúzia). Quando o fornecedor fatura por caixa, o preço da NF entra como se fosse por unidade e quase todo item vira divergência. Além disso o relatório mostra dois números que não fecham ("9 Correto / 7 Divergência / 10 Faltando" e "22 divergência(s)").

## 1. Extrair a unidade da nota

No prompt de OCR do modo "conferência", passar a pedir também a unidade de cada item, exatamente como aparece na nota (CX, UN, FD, DZ, PCT...), ou `null` quando a nota não informar. Formato de retorno: `[{produto, unidade, quantidade, preco_unitario}]`.

## 2. Converter por unidade (nova biblioteca + testes)

### Nova lógica isolada em `src/lib/ocrUnidade.ts`, com os mapeamentos de unidade e a função de normalização:

- Unidade da NF é embalagem (CX, FD, DZ, PCT, DP) **e** o fator do item pedido é > 1:
  - preço normalizado = preço da NF ÷ fator
  - quantidade normalizada = quantidade da NF × fator
- Unidade é UN/UNI, ou o fator é 1: usa os valores como vieram.
- Unidade veio `null`: **não converte**. O item é marcado como `unidade_indefinida` e exige conferência manual — nunca adivinhar.

O fator vem sempre do snapshot do pedido (`cotacao_produtos.fator_embalagem`), que já é o que a tela carrega hoje; nenhum JOIN novo em `produtos`.

Teste automatizado (`src/lib/ocrUnidade.test.ts`) cobrindo os três casos: embalagem convertida, unidade simples, unidade ausente.

## 3. Uma única fonte de verdade para divergências

Causa dos números discordantes: o resumo do relatório conta **linhas da nota + itens faltantes** (26 linhas) comparando só quantidade, enquanto o aviso amarelo conta **itens do pedido** comparando quantidade **e** preço (22).

Correção: o relatório e o contador passam a derivar do mesmo cálculo — a lista de itens do pedido, com o mesmo critério de divergência (quantidade ou preço) usado nos cartões. Itens que aparecem na nota mas não no pedido continuam listados, porém em um grupo próprio ("na nota, fora do pedido") que não entra na contagem de divergências do pedido. Assim: `Correto + Divergência + Faltando + Unidade indefinida = total de itens do pedido`, e o aviso amarelo repete exatamente o número de "Divergência".

## 4. Mostrar o preço já normalizado

Para cada item convertido, o relatório e o cartão mostram o preço por unidade com a origem explícita:

```text
R$ 9,29/un — NF: CX R$ 46,45
```

Itens com `unidade_indefinida` recebem selo discreto "Confira a unidade" no cartão, com o valor bruto da NF preservado no campo editável.

## Responsivo

- 360px: preço normalizado em segunda linha (sem estourar largura), selos com quebra.
- Desktop: mesma informação na mesma linha, sem mudar a estrutura atual dos cartões.
- Layout verificado nos dois formatos.

## Fora do escopo

Nada de mudança em `complete-conferencia` nem no esquema de `conferencias` / `conferencia_itens`. Os valores gravados continuam sendo os por unidade já confirmados na tela.

## Detalhes técnicos

- `supabase/functions/ocr-nota-fiscal/index.ts`: acrescenta `unidade` ao prompt/JSON do modo `conferencia` (modo `importar` intacto).
- `src/lib/ocrUnidade.ts`: `UNIDADES_EMBALAGEM`, `classificarUnidade()`, `normalizarLinhaNf({unidade, quantidade, preco_unitario}, fator)` → `{quantidade, preco_unitario, convertido, unidadeIndefinida, origem}`.
- `src/components/ConferenciaPedidos.tsx`: `handleOcrUpload` normaliza antes de comparar; `OcrStatus` ganha `unidade_indefinida`; resumo, aviso e cartões passam a ler o mesmo cálculo de divergência.