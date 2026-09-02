# Corrigir o botão "Registrar pagamento manual" cortado no mobile

## O que está acontecendo (verificado no código)

No rodapé do perfil do cliente (`src/components/admin/ClienteDetalhesSheet.tsx`, linhas 303–352) os botões ficam num `flex flex-wrap` onde cada um tem `flex-1` com largura mínima fixa:

- WhatsApp / Email: `min-w-[120px]`
- Alterar plano: `min-w-[140px]`
- Registrar pagamento manual: `min-w-[180px]`
- Excluir cliente: `min-w-[140px]`

Em telas de 360–411px, "Alterar plano" (140px) e "Registrar pagamento manual" (180px) somam mais que a largura disponível, então o texto do botão longo estoura para fora da borda — exatamente o que aparece na captura.

## O que será feito

1. Rodapé passa a usar grade de 2 colunas no mobile: WhatsApp | Email na primeira linha, "Alterar plano" e "Registrar pagamento manual" logo abaixo, e "Excluir cliente" em linha própria ocupando a largura toda.
2. Remover as larguras mínimas fixas (`min-w-[...]`) para que nenhum botão force a linha a estourar.
3. Rótulo do botão longo com `truncate` e texto encurtado no mobile ("Pagamento manual"), voltando ao texto completo a partir de `sm`, mantendo o `title`/`aria-label` completo.
4. No desktop o rodapé continua com a mesma aparência de hoje (botões em linha).

## Detalhes técnicos

- Arquivo único: `src/components/admin/ClienteDetalhesSheet.tsx` (apenas o bloco do rodapé).
- Somente classes Tailwind e rótulo/acessibilidade; nenhuma query, mutation ou regra de negócio alterada (o `PagamentoManualDialog` e os handlers continuam idênticos).
- Manter o `pb-[max(0.75rem,env(safe-area-inset-bottom))]` do rodapé.

## Verificação

- Playwright em 320px, 360px, 411px e desktop conferindo `scrollWidth === clientWidth` no rodapé e cada botão com bounding box dentro da viewport.
- Screenshot do rodapé no mobile antes/depois.
