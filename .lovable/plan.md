# Corrigir produtos duplicados na cotação

## O que está acontecendo (confirmado nos dados)

Sua cotação ativa de 18/08 tem 209 itens e **7 produtos repetidos**, exatamente estes:

| Produto | Vezes na cotação |
|---|---|
| Amaciante Comfort Tradicional Azul Explosão 1,8lt | 3 |
| Shampoo Seda Liso Perfeito 325ml | 2 |
| Cadeado Pado SM E-20mm Blister | 2 |
| Inseticida SBP Multi Inset Citronela 380ml | 2 |
| Creme Dental Tandy Morango 50g | 2 |
| Creme Dental Colgate Sensitive Pro Alívio 60g | 2 |
| Shampoo Pantene Anti-Queda 175ml | 2 |

A causa está na importação dos itens do app de Funcionários (aba Reposição). Cada um desses produtos foi registrado pelo funcionário **mais de uma vez** em dias diferentes (ex.: o Amaciante Comfort aparece 3 vezes na lista de faltantes — 05/08, 05/08 e 15/08). Na hora de importar, o sistema só verifica se o produto **já está** na cotação; ele **não verifica repetições dentro do próprio lote que está sendo importado**. Resultado: 3 registros do mesmo item = 3 linhas na cotação.

O "Leite Coco Sococo Vidro Tradicional 200ml" hoje aparece só uma vez na cotação (você já removeu a cópia). Mas há um segundo tipo de repetição: o mesmo produto registrado com nomes diferentes ("Leite de Coco Sococo Tradicional Vidro 200ml", "Leite De Coco Sococo 200ml Tradicional Vidro"). Esses são itens digitados manualmente, sem código de barras, e o sistema os trata como produtos diferentes.

## Correções

### 1. Importação nunca mais duplica (causa raiz)
Na importação da aba Reposição:
- Agrupar os itens do lote **antes** de inserir, por código de barras / item do catálogo (e, para itens sem código, por nome normalizado — sem acentos, maiúsculas e espaços extras).
- Quando o mesmo produto aparecer várias vezes, criar **uma única linha** na cotação com a **soma das quantidades** (ex.: 3 registros do Amaciante = 1 linha, quantidade somada).
- Se o produto já estiver na cotação, **somar a quantidade** na linha existente em vez de ignorar o item (hoje ele é simplesmente descartado e a necessidade extra se perde).
- Aplicar a mesma regra também para os itens locais (nome), evitando duplicata quando existem dois produtos cadastrados com o mesmo nome.
- Mensagem final passa a informar: "X itens importados, Y agrupados por repetição".

### 2. Aviso na própria lista de Reposição
Marcar visualmente itens pendentes repetidos ("2x na lista") para o comprador enxergar antes de importar, sem bloquear nada.

### 3. Limpar a cotação ativa de hoje
Remover as 8 linhas repetidas da cotação de 18/08 (mantendo uma de cada, com a maior quantidade registrada). Isso é ajuste de dados pontual, feito uma vez.

## Detalhes técnicos

- `src/pages/FuncionariosPage.tsx` (`importarMutation`): trocar os `Set` de `existingProdIds`/`existingCatIds` por um mapa `chave -> { cpId, quantidade }` alimentado com `catalogo_mestre_id`, `ean` e nome normalizado; acumular o lote nesse mapa; gerar `insert` para chaves novas e `update` de quantidade para chaves já existentes.
- Extrair a normalização e o agrupamento para funções puras em `src/lib/itensFaltantesImport.ts` (`chaveItemFaltante`, `agruparItensParaImportacao`) com testes em `itensFaltantesImport.test.ts` — inclui casos de acento, caixa e EAN igual com nomes diferentes.
- Badge de repetição na lista de pendentes calculado no cliente pela mesma chave, sem query nova.
- Limpeza dos dados: `DELETE` nas linhas duplicadas de `cotacao_produtos` da cotação `Cotação 18/08/2026`, removendo antes os registros de `precos` vinculados às linhas descartadas (mantendo os preços da linha preservada).
- Sem mudança de schema. Nenhuma alteração no fluxo de preços, envio a fornecedores ou análise.

## Fora de escopo

Unificação automática de nomes parecidos por IA (caso "Leite de Coco" escrito de 3 formas). Depois da correção acima, se ainda incomodar, avalio um detector de similaridade na importação.
