# Seleção de fornecedores e prazo começam desmarcados

Hoje o modal "Fornecedores da Cotação" já vem com **todos os fornecedores marcados** e com **"Sem prazo definido" marcado**. O cliente não escolhe nada — ele apenas desfaz o que o sistema decidiu. A mudança inverte isso: nada vem marcado, o cliente marca o que quiser.

## Comportamento novo

**Fornecedores**
- Ao abrir uma cotação nova (sem fornecedores salvos ainda), nenhum fornecedor aparece marcado.
- O cliente marca os que participam e salva. O botão "Salvar Seleção" fica desabilitado enquanto nenhum fornecedor estiver marcado.
- Cotação que já tem fornecedores salvos continua abrindo exatamente com o que foi salvo antes (sem alteração).
- "Selecionar todos" / "Desmarcar todos" continuam funcionando igual.

**Prazo para resposta**
- O campo de data/hora abre vazio e a caixa "Sem prazo definido" abre **desmarcada**.
- Se o cliente salvar sem preencher a data e sem marcar a caixa, a cotação fica sem prazo (mesmo resultado de hoje, mas por escolha dele).
- Se a cotação já tiver prazo salvo, ele aparece preenchido como hoje.
- Os atalhos +4h / +8h / +24h / +48h continuam funcionando.

## Detalhes técnicos

`src/components/cotacao/ModalFornecedores.tsx`
- Trocar a regra de "marcado" de `selectedSuppliers[f.id] !== false` para `=== true` nos três pontos: `checked` do Checkbox, classe visual do card e `selectedCount`.
- Estado inicial do prazo: `semPrazo` passa a iniciar `false` sempre; `prazoLocal` inicia vazio quando não há `prazoIso`.
- Desabilitar o botão de salvar quando `selectedCount === 0` (além do `saving` atual).

`src/pages/CotacaoPage.tsx`
- No efeito de sincronização (branch "cotação sem fornecedores salvos"), remover a inicialização que marca todos como `true` — deixar o mapa vazio.
- Ajustar o `useMemo` de `fornecedores` para `selectedSuppliers[f.id] === true`, mantendo a tabela e os cálculos coerentes com a nova regra.

`src/pages/DashboardPage.tsx` já usa `selectedSuppliers[f.id]` (truthy) e só popula a partir do banco — nenhuma alteração necessária.

Nenhuma query, mutação ou lógica de salvamento (`saveSupplierSelection`) muda. Validação de layout em 360px e desktop.
