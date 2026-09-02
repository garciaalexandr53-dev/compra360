# Itens sem preço visíveis no relatório e no histórico

Hoje, quando um item não recebe nenhum preço válido, ele aparece no detalhe do histórico com fornecedor "—" e sem valor, misturado no meio de dezenas de linhas. Não existe nenhum lugar que diga "estes X itens ficaram sem preço e não entraram em nenhum pedido".

Na cotação de 02/09/2026, por exemplo, são 19 itens nessa situação (Seda, Elseve, macarrão Liane, querosene, sal União etc.) — impossível de identificar rapidamente na lista de 235 itens.

## O que muda

### 1. Detalhe da cotação no Histórico
- Um bloco novo, logo abaixo do resumo por fornecedor: **"Itens sem preço (N)"**, recolhível (fechado por padrão).
- Lista cada item sem preço válido com nome, embalagem e quantidade pedida.
- Texto curto de contexto: "Nenhum fornecedor informou preço para estes itens, então eles não entraram em nenhum pedido."
- Contador também no cabeçalho do detalhe, ao lado do total geral, para ser visível sem abrir o bloco.

### 2. Exportações (Excel, PDF e Impressão)
- Excel: nova aba **"Itens sem preço"** com Item, Embalagem, Fator, Quantidade.
- PDF e Impressão: seção "Itens sem preço (N)" no fim do documento, com a mesma lista.
- Quando não houver nenhum item sem preço, a aba/seção não é criada.

## Regra usada

Item sem preço = nenhum registro de preço com valor maior que zero. Preço 0,00 (fornecedor que não trabalha o item) continua contando como "não cotou", exatamente como já acontece hoje no cálculo do vencedor — então a lista é sempre coerente com o total geral do relatório.

## Detalhes técnicos

- `src/pages/HistoricoPage.tsx`: derivar `itensSemPreco` a partir de `buildTableRows()` (linhas com `precoUnit == null`) — nenhuma query nova, reaproveita os dados já paginados de `cotacao-details-v2`. Novo estado local para o toggle do bloco.
- `src/lib/historicoExports.ts`: adicionar campo opcional `itensSemPreco: ExportRow[]` (ou reaproveitar as próprias rows filtradas) e renderizar a aba/seção em `exportCotacaoToExcel`, `exportCotacaoToPdf` e `printCotacao`.
- Sem alterações de banco, de queries ou de lógica de cálculo de vencedor/total.
- Validação: `tsgo --noEmit`, além de checagem visual em 360px e desktop no detalhe da cotação de 02/09.

## Fora de escopo

O módulo maior de itens sem preço (banner na análise/resumo/pedidos, carregar automaticamente para a próxima cotação) permanece no backlog.
