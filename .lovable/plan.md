# Corrigir o botão "Fechar agora" na matriz da cotação

## O que está acontecendo (verificado no código)

Na `CotacaoPage`, o banner verde "Todos os fornecedores responderam" tem o botão **Fechar agora** que hoje chama `setNovaCotacaoOpen(true)` — ou seja, abre o modal **Nova Cotação** (manter itens / zerar tudo), como se a compra já tivesse terminado.

O mesmo acontece no fluxo do banner âmbar "seguir sem os fornecedores pendentes": depois de remover os pendentes, o código também abre o modal de Nova Cotação.

Isso está errado: fechar a cotação significa **parar de receber preços e seguir para a análise/pedidos**. A nova cotação só faz sentido depois que os pedidos foram enviados.

## Correção

1. **Fechar agora** passa a levar o usuário para a próxima etapa do fluxo: navegar para `/analise`.
2. Rótulo mais claro: **"Fechar e analisar"**, mantendo o mesmo estilo do banner verde.
3. No fluxo "seguir sem os pendentes": após remover os fornecedores pendentes e atualizar os dados, navegar para `/analise` em vez de abrir o modal de Nova Cotação. O texto do toast passa a indicar que a cotação seguiu para a análise.
4. A opção **Nova cotação** continua existindo no menu "Mais" e na tela de conclusão (depois do envio dos pedidos) — nada muda ali.

## Verificação

- Com 100% dos fornecedores respondidos, clicar em "Fechar e analisar" deve abrir a tela de Análise da cotação ativa (sem nenhum modal de nova cotação).
- No banner âmbar, "Remover e fechar" deve remover os pendentes e cair na Análise.
- Menu "Mais" > "Nova cotação" continua abrindo o modal como antes.
- Mobile 360px e desktop sem mudança de layout.

## Detalhes técnicos

- Arquivo único: `src/pages/CotacaoPage.tsx`.
- Trocar `onClick={() => setNovaCotacaoOpen(true)}` do botão do banner verde por `onClick={() => navigate("/analise")}`.
- Em `handleSkipPending`, substituir `setNovaCotacaoOpen(true)` por `navigate("/analise")` após as invalidações de query.
- Sem migração de banco, sem alteração de cálculos ou de outras telas.
