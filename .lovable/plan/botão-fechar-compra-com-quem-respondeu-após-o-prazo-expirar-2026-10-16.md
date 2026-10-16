# Botão "Fechar compra com quem respondeu" após o prazo expirar

## Problema
Quando o prazo da cotação vence e ainda há fornecedores que não responderam, o Painel fica parado no estado de "aguardando respostas". Um cliente novo não sabe o que fazer — não fica claro que ele pode seguir sem os pendentes.

## O que muda para o usuário
- Enquanto o prazo **ainda não venceu**: nada muda. O painel mostra a contagem regressiva e o status dos fornecedores normalmente.
- Quando o **prazo expira** e ainda há fornecedores pendentes: aparece um destaque no Painel com:
  - Texto claro: "⏰ O prazo terminou. X fornecedores não responderam."
  - Botão principal: **"Fechar compra com quem respondeu"**
  - Ao clicar, abre confirmação simples: "Seguir sem [nomes dos fornecedores]? Eles serão desconsiderados desta cotação e você irá direto para os melhores preços." → Confirmar remove os pendentes da cotação e leva para a Análise (`/analise`).
- Se **nenhum** fornecedor respondeu: o botão não aparece (não há compra a fechar); mantém orientação de reenviar o link ou estender o prazo.
- Cotação **sem prazo definido**: comportamento atual mantido (banner âmbar existente de "seguir sem os pendentes" continua disponível).

## Regras
- O botão só existe quando: prazo expirado + pelo menos 1 resposta recebida + pelo menos 1 fornecedor pendente.
- A remoção dos pendentes reutiliza a lógica já existente de "seguir sem os pendentes" (mesma mutação, mesmas invalidações de query).
- Nada muda no banco de dados, no link do fornecedor, nem no cálculo de preços.

## Detalhes técnicos
- Arquivo principal: `src/pages/DashboardPage.tsx` — no estado de aguardando respostas, adicionar condição `prazoExpirado && respondidos > 0 && pendentes > 0` para renderizar o novo bloco.
- Reutilizar `formatTimeRemaining`/`prazo_resposta` já carregados e o fluxo de `handleSkipPending` (remover pendentes → invalidar queries → navegar para `/analise`).
- AlertDialog de confirmação listando os nomes dos fornecedores pendentes.
- Teste pequeno em `src/lib/` para a regra de exibição (prazo expirado + respostas + pendentes), seguindo o padrão de `prazoCotacao.test.ts`.

## Verificação
- `tsgo` e `vitest` verdes antes de publicar.
- Cenário real: cotação com prazo vencido, 2 pendentes, demais respondidos → botão aparece; confirmar leva à Análise sem os pendentes.
- Antes do prazo vencer: botão não aparece.
