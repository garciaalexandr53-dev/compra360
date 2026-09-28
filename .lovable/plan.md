# Ordem alfabética e divergências clicáveis na Conferência

## 1. Ordem alfabética (A-Z)

Análise feita nas telas com lista de produtos:
- Conferência de pedidos (app de funcionários e painel): sem ordem — **ajustar**.
- Histórico de conferências (tabela ao expandir): sem ordem — **ajustar**.
- Lista de reposição (tela Funcionários): hoje mais recentes primeiro — **ajustar para A-Z**, mantendo as faltas da conferência agrupadas com o selo.
- Pedidos enviados ao fornecedor e portal do fornecedor: já estão em A-Z — sem mudança.
- Matriz da cotação: mantém a ordem atual (já tem filtros e ordenação próprios) — sem mudança.

Ordenação ignora acentos e maiúsculas (ex.: "Açúcar" junto com "Acucar"). Conferências já em andamento reabrem em A-Z sem perder o que já foi marcado.

## 2. Divergências clicáveis no histórico de conferências

- O aviso "N divergência(s) encontrada(s)" vira um botão que abre a lista só com os itens com diferença.
- Cada item mostra: produto, pedido x recebido e a falta ("Faltou 1").
- Selo de situação na lista de reposição:
  - Na lista de reposição (âmbar) — aguardando próxima cotação;
  - Já importado para cotação (verde);
  - Não enviado (cinza) — com botão "Enviar para reposição agora", que registra a falta com embalagem, fator e o selo "Faltou no pedido #N · Fornecedor".
- Na tabela completa, as linhas com divergência ficam destacadas.

## O que não muda
Gravação da conferência, fluxo do conferente, importação de faltas e regras de juntar itens repetidos.

## Detalhes técnicos
- Helper `ordenarPorNome` (localeCompare pt-BR, sensitivity base) em `src/lib/format.ts` ou lib própria, com teste.
- `ConferenciaPedidos.tsx`: ordenar itens ao montar e ao restaurar do localStorage.
- `ConferenciasPage.tsx`: ordenar `expandedItens`; nova query de `itens_faltantes` da loja filtrando `registrado_por` com `PREFIXO_FALTA_CONFERENCIA`; casar por número do pedido (`origemFaltaConferencia`) + nome normalizado (`normalizarNomeItem`); status = importado ? verde : âmbar; ausente = cinza. "Enviar agora" faz insert em `itens_faltantes` (usuário autenticado, dono da loja) e invalida a query.
- `FuncionariosPage.tsx`: ordenação A-Z no cliente, sem mudar a query.
- Sem migração, sem mudança em RPCs/funções. Verificação: tsgo + vitest verdes.
