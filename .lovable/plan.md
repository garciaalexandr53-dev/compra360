# Última quantidade pedida ao adicionar produtos

Ao abrir o diálogo de adicionar item, mostrar quanto daquele produto foi pedido na última cotação fechada daquela loja — com um atalho para reutilizar a quantidade.

## Onde aparece

Nos três pontos que já usam o mesmo diálogo (`AdicionarItemDialog`):

- App Funcionários (aba Itens Faltantes) — loja do link
- Banco de Produtos
- Adicionar produtos ao iniciar uma cotação

## Como fica na tela

Logo abaixo do nome do produto, uma linha discreta:

```text
Último pedido: 3 CX (36 un) · 26/08
                              [Usar]
```

- "Usar" preenche a quantidade (e a embalagem/fator do último pedido, quando diferentes do padrão).
- Sem histórico: nenhuma linha extra aparece (nada de "sem histórico" poluindo a tela).
- Mobile 360px: linha quebra em duas, o botão "Usar" fica alinhado à direita.
- A quantidade continua iniciando em 1 — o histórico é sugestão, não preenchimento automático.

## Qual "último pedido" é usado

A última cotação da loja que gerou pedido enviado e continha aquele item. O casamento do item é feito por:

1. mesmo item do catálogo mestre (quando o produto vem do catálogo), ou
2. mesmo EAN, ou
3. nome normalizado igual (sem acentos, caixa e espaços extras) — regra já usada no projeto.

## Detalhes técnicos

- Nova função no banco `get_ultima_compra_item(_loja_id uuid, _catalogo_mestre_id uuid, _ean text, _nome text)`, `SECURITY DEFINER` com `SET search_path = public`, retornando `quantidade`, `tipo_embalagem`, `fator_embalagem`, `pedido_em`. Fonte: `cotacao_produtos` + `cotacoes` filtrando cotações da loja com `pedidos.status = 'enviado'`, `ORDER BY cotacoes.created_at DESC LIMIT 1`.
- `GRANT EXECUTE` para `anon` (app de funcionários é público, mesmo padrão das RPCs `get_pedido_itens_publico`/`get_produtos_conferencia`) e `authenticated`.
- Novo hook `src/hooks/useUltimaCompra.ts` (TanStack Query, key por loja+item, `staleTime` alto) chamado apenas quando o diálogo abre.
- `AdicionarItemDialog` ganha props opcionais `ultimaCompra` e `onUsarUltimaCompra`; sem elas o comportamento atual não muda. As três páginas passam a loja de contexto (`useLojaAtiva` nas telas autenticadas, `loja_id` do link no app público).
- Testes unitários para a normalização de nome usada no casamento e para o cálculo do total em unidades exibido na linha.
