# Cotação reaberta: liberar ajustes (itens, fornecedores, reenvio)

## Objetivo
Quem reabre uma cotação precisa ajustar. Hoje o painel cai direto na tela de fechamento ("Todos os fornecedores responderam") e não oferece como incluir itens, adicionar fornecedor ou reenviar o link.

## O que o cliente vai ver

1. **Aviso de cotação reaberta** (quando a cotação foi reaberta)
   - Título: "Cotação reaberta para ajustes"
   - Texto: "Adicione itens, inclua fornecedores ou reenvie o link antes de gerar os pedidos novamente."
   - Substitui o título "Todos os fornecedores responderam" nesse caso.

2. **Bloco "Ajustar cotação"** na tela de fechamento (sempre visível nela, em destaque quando reaberta), com 3 botões:
   - **Adicionar produtos** — abre a tela de adicionar produtos da cotação.
   - **Fornecedores e envio** — abre a lista de fornecedores para marcar novos e, em seguida, a fila de envio por WhatsApp (com nome da loja e horário de fechamento já garantidos).
   - **Matriz de preços** — abre a matriz para conferir ou editar.
   - Os botões atuais ("Cotação revisada" e "Ver pedidos prontos para envio") continuam iguais logo abaixo.

3. **Atalho na Matriz**: botão "+ Adicionar produtos" visível no topo da matriz, para incluir item sem voltar ao início.

4. **Reenvio para um fornecedor específico**: na lista da fila, cada fornecedor (inclusive os que já responderam) pode receber o link de novo, para atualizar preços combinados.

## Regras preservadas
- Nada muda na forma de salvar preços, pedidos ou na reabertura em si.
- Itens novos entram como "sem preço" para todos os fornecedores até eles responderem; o painel volta a mostrar respostas parciais automaticamente, se for o caso.

## Detalhes técnicos
- `DashboardPage.tsx`: no bloco do Estado 5 (~linha 1120), ler `cotacaoAtiva.reaberta_em` para trocar título/subtítulo; inserir grid de 3 botões (`navigate("/add-produtos")`, abrir `ModalFornecedores` já montado na ~1225 e depois `SendQueueModal`, `navigate("/cotacao")`). Tokens semânticos, layout mobile-first (3 colunas compactas ou empilhado).
- `CotacaoPage.tsx`: botão "+ Adicionar produtos" na toolbar seguindo o padrão de toolbar limpa; passar `prazoIso` ao `ModalFornecedores`.
- Sem mudanças no banco nem nas consultas existentes.
- Teste: pequena função `estadoCotacaoReaberta(cotacao)` com testes (reaberta => mostra aviso; não reaberta => título normal). Rodar `tsgo` e `vitest`; validar o fluxo no navegador com uma cotação reaberta.
