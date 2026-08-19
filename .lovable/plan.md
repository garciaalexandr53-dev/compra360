# Corrigir a busca por item no Histórico

## O que está acontecendo (verificado no banco e no código)

A aba "Buscar Item" do Histórico busca primeiro na tabela de **produtos cadastrados** (banco local do cliente) e só depois procura as linhas de cotação que apontam para esses cadastros. Itens que entraram na cotação pelo **catálogo mestre** não têm vínculo com um produto local, então nunca aparecem na busca.

Números reais das cotações:

| Data | Itens na cotação | Vindos de cadastro local | Vindos do catálogo mestre |
| --- | --- | --- | --- |
| 19/08 (hoje) | 199 | 33 | 166 |
| 17/08 | 108 | 58 | 50 |
| 05/08 | 151 | 72 | 79 |
| 13/07 | 63 | 63 | 0 |
| 23/06 | 114 | 114 | 0 |

Ou seja: não é só hoje. A busca começou a falhar quando o catálogo mestre passou a ser a fonte principal dos itens — hoje **83% dos itens da cotação são invisíveis** na busca. Nas cotações antigas (junho/julho) quase tudo vinha de cadastro local, por isso a busca parecia funcionar.

Há ainda dois limitadores secundários na mesma busca:
- ela considera no máximo 20 produtos cadastrados por termo;
- as leituras de itens e de preços não são paginadas (o backend devolve no máximo 1.000 linhas por consulta), então resultados podem ser cortados conforme o histórico cresce.

## Correção

1. Buscar direto pelo **nome gravado na linha da cotação** (todas as 1.457 linhas existentes têm esse nome preenchido), em vez de partir dos produtos cadastrados. Assim itens do catálogo mestre, itens locais e itens digitados à mão aparecem igualmente.
2. Remover o limite de 20 e paginar a busca; carregar os preços em blocos, como já é feito na aba de cotações.
3. Considerar apenas cotações não ativas (mesmo critério da aba "Cotações"), para o Histórico não misturar a cotação em andamento.
4. Manter tudo o resto igual: agrupamento por produto, alternância "todos os fornecedores" / "vencedor por cotação", paginação por grupo, exports e demais abas.

## Detalhes técnicos

- Em `src/pages/HistoricoPage.tsx`, a query `item-search` passa a consultar `cotacao_produtos` com `ilike` em `nome` (mantendo o join com `cotacoes` para nome/data/status e com `produtos` apenas para a embalagem quando existir), usando `fetchAllRows` de `src/lib/supabaseHelpers.ts`.
- Filtro `cotacoes.status <> 'ativa'` aplicado no resultado, já que o filtro por coluna de tabela relacionada não é confiável nesse formato de consulta.
- Preços buscados em blocos de ~200 ids com `gt("preco", 0)`, como na query `cotacoes-historico-v2`.
- Sem migração de banco e sem mudança de layout. Validar em 360px e desktop com um item do catálogo mestre da cotação de hoje.
