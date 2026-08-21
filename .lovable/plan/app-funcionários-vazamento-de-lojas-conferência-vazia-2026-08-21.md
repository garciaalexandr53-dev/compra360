# App Funcionários: vazamento de lojas + Conferência vazia

## Problema 1 — seletor mostrando lojas de todos os clientes (confirmado)

O app público chama `get_lojas_public` sem informar a loja. Nesse caso a função devolve **todas as lojas cadastradas no sistema**, de todos os usuários, e o seletor aparece com essa lista. Isso só acontece quando o app abre **sem** o `?loja=` na URL — exatamente o caso do ícone instalado na tela inicial: o manifest define `start_url: "/reposicao"`, sem parâmetro de loja. No seu celular você abriu pelo link, então o seletor nem apareceu. O atalho já instalado também não se corrige mudando o manifest — o Android congela o `start_url` na instalação.

## Problema 2 — Conferência sem nenhum pedido (confirmado)

A aba Conferência do app público lê as tabelas `pedidos`, `cotacao_produtos` e `precos` **diretamente**. As políticas de leitura dessas três tabelas exigem usuário autenticado e dono do registro (`created_by = auth.uid()`). O app de funcionários não tem login, então essas consultas voltam **sempre vazias** — não é problema do aparelho nem do link. Além disso, a consulta de pedidos não filtra por loja: se voltasse dado, viria pedido de qualquer unidade.

## O que será feito

1. **Fechar o vazamento de lojas.** `get_lojas_public` passa a exigir a loja: sem `_loja_id`, não retorna nada. Nenhuma outra tela usa essa função.

2. **Remover o seletor de lojas do app público.** A loja vem só do `?loja=` do link ou da loja já vinculada àquele aparelho. O colaborador nunca escolhe numa lista.

3. **Tela de orientação quando abrir sem loja.** Abrindo pelo ícone sem loja no link nem no aparelho: mensagem clara "Abra o link de reposição enviado pelo seu gerente", sem lista alguma. Depois do primeiro acesso pelo link, o ícone volta a funcionar (a loja fica vinculada ao aparelho).

4. **Conferência funcionando por loja.** Criar acesso público controlado e restrito à loja do link:
   - lista de pedidos com status "enviado" **daquela loja**;
   - itens e preços cotados **daquele pedido**.
   Nada fora da loja do link fica acessível.

5. **Sempre dados frescos ao abrir.** Revalidar loja, pedidos, produtos e enviados ao abrir/retomar o app, para não mostrar informação velha em cache.

6. **Confirmação visível da loja.** Manter/reforçar o nome da loja no topo, na Conferência e antes de enviar.

## Detalhes técnicos

- Migração 1: `CREATE OR REPLACE FUNCTION public.get_lojas_public(_loja_id uuid DEFAULT NULL)` com `IF _loja_id IS NULL THEN RETURN; END IF;` (mesma assinatura, `SECURITY DEFINER`, `search_path = public`).
- Migração 2: duas funções `SECURITY DEFINER` no padrão de `get_itens_enviados_publico`:
  - `get_pedidos_conferencia_publico(_loja_id uuid)` → pedidos `status='enviado'` com `loja_id = _loja_id` (id, numero, total, created_at, fornecedor_id, nome do fornecedor);
  - `get_pedido_itens_publico(_loja_id uuid, _pedido_id uuid)` → itens de `cotacao_produtos` + preço do fornecedor do pedido, validando que o pedido pertence à loja e está `enviado`.
  Ambas com `GRANT EXECUTE ... TO anon, authenticated`; nenhuma política de tabela é afrouxada.
- `src/components/ConferenciaPedidos.tsx`: aceitar prop `lojaId` opcional; no modo público usar as RPCs acima; a tela do gestor (`FuncionariosPage`) mantém as queries atuais intactas.
- `src/pages/AppFuncionariosPublic.tsx`: remover `lojaSelector` e seus três pontos de render; passar `lojaId={selectedLojaId}` para a Conferência; remover auto-select por "loja única"; estado de "sem loja" com instrução; revalidação em foco/montagem.
- Manifest: mantém `start_url: "/reposicao"`; a recuperação é via loja persistida + tela de orientação.

Verificação: no navegador em 360px — `/reposicao` sem parâmetro (orientação, sem lista de lojas) e `?loja=<id>` (Itens Faltantes e Conferência carregando pedidos daquela loja). Testes existentes do app público seguem verdes.
