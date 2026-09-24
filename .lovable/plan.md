# Inativar loja (em vez de excluir)

## Como vai funcionar
- No detalhe da loja, o botão "Excluir" passa a ser **"Inativar loja"** quando ela tem cotações ou pedidos. Uma loja sem histórico ainda pode ser excluída de verdade.
- Uma loja inativa **some de todos os lugares**: seletor de loja no topo, Painel, Fornecedores, Produtos, Cotações, app de funcionários, links da Rede e sugestões de fornecedores.
- Se a loja inativada era a loja selecionada, o sistema passa automaticamente para outra loja ativa.
- **O histórico fica guardado**: cotações e pedidos antigos continuam no banco, sem perder nada.
- **Como reativar**: na página Lojas, no fim da lista, um link discreto "Ver lojas inativas (1)" mostra essas lojas com o botão "Reativar". É o único lugar em que elas aparecem.
- Loja inativa não conta no limite de lojas do plano.
- A mensagem técnica em inglês é trocada por um aviso claro em português.

## Detalhes técnicos
- Migração: `lojas.ativo boolean not null default true`.
- `useLojaAtiva`: filtra `ativo = true`; se `loja_ativa_id` for de uma loja inativa, troca para a primeira loja ativa.
- LojasPage: lista principal só mostra ativas; um bloco que abre e fecha lista as inativas com o botão Reativar; `checkLimit("max_lojas")` conta só as ativas.
- LojaSheet: se a loja tiver cotações, mostra "Inativar" (update `ativo=false`), senão "Excluir"; o erro 23503 é traduzido.
- Funções públicas e de sugestão (`get_lojas_public`, `loja_exists`, convite `?c=`, `sugerir_fornecedores_por_cidade`, app de funcionários) passam a ignorar lojas inativas.
- Nenhuma consulta de histórico ou de pedidos é alterada.
