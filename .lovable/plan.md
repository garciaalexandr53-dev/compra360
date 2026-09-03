# Embalagem colapsada no diálogo de adicionar item

Boa ideia: hoje as 9 opções de embalagem ocupam duas linhas e roubam atenção da quantidade, que é o campo que realmente importa. Como o valor pré-definido (catálogo ou cadastro) acerta na maioria dos casos, ele pode ficar visível e o resto escondido.

Muda em um único componente (`AdicionarItemDialog`), então os três pontos — App Funcionários (Itens Faltantes), Banco de Produtos e Adicionar produtos à cotação — herdam a mudança junto.

## Como fica

Estado normal (fechado):

```text
Embalagem
[ CX ]  Alterar
```

- Mostra apenas a embalagem atual como chip destacado (verde, igual ao selecionado de hoje).
- Ao lado, link discreto "Alterar".
- Toque no chip também abre — área de clique maior no celular.

Ao tocar em "Alterar":

- As 9 opções aparecem no mesmo lugar (UNI, CX, DZ, ½DZ, DP, FD, KG, PCT, LT), como já são hoje.
- Escolher uma opção aplica e volta a colapsar automaticamente, com o fator recalculado como já acontece.

Abre expandido automaticamente quando o item não tem embalagem definida (cai em UNI por padrão), para não esconder uma escolha que provavelmente precisa ser feita.

## Detalhes de comportamento

- Nada muda no fator, no cálculo de total de unidades, no aviso "Ajustado (padrão do catálogo: …)" nem no botão "Voltar ao padrão".
- A sugestão "Último pedido: 3 CX (72 un) · 26/08" com o botão "Usar" continua igual; usar a sugestão aplica a embalagem e mantém o campo colapsado mostrando o novo valor.
- Reabrir o diálogo para outro item volta ao estado colapsado.

## Detalhes técnicos

- Apenas `src/components/shared/AdicionarItemDialog.tsx`: novo estado local `embalagemAberta`, reiniciado no `useEffect` que já roda por produto (aberto quando `produto.embalagem` é vazio/não reconhecido).
- `handleEmbalagemChange` passa a fechar a lista após a seleção; `usarUltimaCompra` mantém fechada.
- Sem mudanças de props, de contratos com as três páginas, de queries ou de banco.
- Layout mantém o chip e o link na mesma linha com `flex-wrap`, testado em 360px e desktop.
