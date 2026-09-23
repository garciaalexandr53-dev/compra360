# Relatório do histórico: remover lista completa de itens (PDF e Imprimir)

## Objetivo
Hoje o relatório gerado a partir do Histórico (e também pelo botão "Baixar PDF" da tela de conclusão) exibe, em primeiro lugar, uma tabela com **todos os itens** da cotação (produto, embalagem, fator, qtd, fornecedor vencedor, preço un. e total). O usuário pediu para **remover essa primeira seção** e manter apenas:

1. **Pedidos por fornecedor** (itens agrupados por fornecedor vencedor, com subtotal)
2. **Itens sem preço** (itens que nenhum fornecedor cotou — ou seja, não foram comprados)

## Escopo
- **Formatos afetados:** PDF (`exportCotacaoToPdf`) e Impressão (`printCotacao`).
- **Excel NÃO muda:** mantém a estrutura atual com todas as abas (Resumo, Pedidos por fornecedor, Itens sem preço, Todos os preços).

## Arquivo alterado
`src/lib/historicoExports.ts`

### 1. `exportCotacaoToPdf`
- Remover o bloco `autoTable` da "tabela principal" que mapeia `rows` (Produto, Embal., Fator, Qtd, Fornecedor, Preço un., Total) com o rodapé "TOTAL GERAL".
- Manter o cabeçalho do PDF (logo, título "Relatório de Cotação", metadados da cotação: nome, datas, status, unidade, total, produtos, fornecedores).
- Como o cálculo da posição `y` do próximo bloco usava `(doc as any).lastAutoTable.finalY`, substituir por controle manual com a variável `y` (após o bloco de metadados).
- **Pedidos por fornecedor:** iniciar logo após os metadados, usando `y` como `startY`. Manter o loop atual por fornecedor com subtotal. Após o loop, atualizar `y` com `lastAutoTable.finalY`.
- **Itens sem preço:** manter a lógica atual, recalculando o cursor a partir de `y`/`lastAutoTable.finalY`.
- Rodapé de numeração de páginas permanece igual.
- O `total_pedido` continua sendo exibido nos metadados do cabeçalho (calculado em `cotacaoPdfById.ts`), então o total geral continua visível mesmo sem a tabela de todos os itens.

### 2. `printCotacao`
- Remover a seção `<h2>Resumo do pedido</h2>` e a `<table>` que lista `rowsHtml` (todos os itens) com o rodapé "TOTAL GERAL".
- Manter o cabeçalho HTML (logo, título, metadados com o total).
- Manter `<h2>Pedidos por fornecedor</h2>` + `pedidosHtml`.
- Manter `<h2>Itens sem preço</h2>` + `semPrecoHtml`.
- A variável `totalGeral` deixa de ser usada na tabela removida; se não houver outra referência, remover para evitar `unused var`.

## Resultado esperado
- O PDF e a impressão começam direto pelos **pedidos por fornecedor**, seguidos dos **itens sem preço** — sem a tabela longa de todos os itens no início.
- Excel permanece inalterado.
- Sem mudanças em consultas/mutações do backend; apenas apresentação do relatório.

## Verificação
- `tsgo` (typecheck) sem erros.
- `vitest` verde (executar `bunx vitest run` — erro pré-existente "Failed to execute 'dispatchEvent'" é ruído, ignorar).
- Conferir visualmente um PDF gerado: deve abrir já em "Pedidos por fornecedor".
