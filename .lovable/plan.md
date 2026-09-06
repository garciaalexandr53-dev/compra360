# Reposicionar elementos no diálogo Adicionar Item

Ajuste de layout no `AdicionarItemDialog` (usado em 3 pontos: App Funcionários – Itens Faltantes, Banco de Produtos e Adicionar produtos à cotação). Mudança puramente visual; sem alterar props, contratos, queries ou banco.

## Layout final (topo → base)

```text
┌──────────────────────────────────────────┐
│ Groselha Asteca 500ml   [CATÁLOGO]   ✕   │
│ (subtítulo, se houver)                    │
├──────────────────────────────────────────┤
│ Embalagem                      Alterar   │
│ [ CX ]                                   │
├──────────────────────────────────────────┤
│ Fator (un/embalagem)  Quantidade pedido  │
│ [ 12 ]               [ 1 ]              │
│ ⚠ fator inválido / "Ajustado... Voltar"  │
├──────────────────────────────────────────┤
│ 1 CX = 12 unidades                       │
├──────────────────────────────────────────┤
│ Último pedido: 1 CX (12 un) · 18/08  Usar│   ← movida para cá
├──────────────────────────────────────────┤
│ [ Cancelar ]        [ Adicionar ]         │
└──────────────────────────────────────────┘
```

## Três mudanças

1. **Linha "Último pedido"** deixa o topo e passa a ficar logo acima dos botões Cancelar/Adicionar, abaixo da linha de total. Mantém o cartão cinza, o texto e o botão "Usar". Remove o `-mt-2` atual (era para grudar no cabeçalho; na nova posição não se aplica). Continua aparecendo só quando `ultimaCompra` existe.

2. **Fator + Quantidade lado a lado** em uma única linha com `grid grid-cols-2 gap-3`.
   - Coluna esquerda: rótulo "Fator (un/embalagem)" + input numérico (centralizado, h-12).
   - Coluna direita: rótulo "Quantidade do pedido" + input numérico (centralizado, h-12, fonte maior em negrito, mantém `autoFocus`).
   - Ambos mantêm `inputMode="numeric"`, `onFocus={(e)=>e.target.select()}` e o sanitize de não-dígitos.
   - O aviso de fator inválido e o bloco "Ajustado (padrão do catálogo/cadastro) … Voltar ao padrão" passam a ocupar a largura total logo abaixo da grade.

3. **Total e rodapé** continuam idênticos, abaixo da linha de último pedido.

## Escopo e segurança

- Arquivo único: `src/components/shared/AdicionarItemDialog.tsx`.
- Sem mudanças de props, estado, handlers, lógica de fator/embalagem, hook `useUltimaCompra`, queries ou banco.
- Manter o reset estável por `produtoKey` (não regredir o bug do "dialog reseta o que você digitou").
- Testar em 360px (mobile) e desktop; typecheck verde.
