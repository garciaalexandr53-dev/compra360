# Corrigir vazamento de lojas no app Funcionários

## O problema (confirmado no código)

1. **Seletor com todas as lojas de todos os clientes.** O app público chama a função `get_lojas_public` sem informar a loja. Nesse caso ela devolve **todas as lojas cadastradas no sistema**, de todos os usuários. Quando o app abre sem o `?loja=` na URL, o seletor aparece com essa lista completa — foi exatamente o que você viu no celular do colaborador. No seu celular você abriu pelo link (`?loja=...`), então o seletor nem aparece.

2. **Por que o atalho instalado abre sem a loja.** O manifest do app de reposição define `start_url: "/reposicao"`, sem parâmetro de loja. Ao abrir pelo ícone da tela inicial, o Android não usa o link original — entra em `/reposicao` puro, cai no caso "sem loja" e mostra a lista geral. O ícone instalado também não pode ser "corrigido" só mudando o manifest: Android congela `start_url` na instalação.

## O que será feito

1. **Fechar o vazamento no banco (correção principal).** `get_lojas_public` passa a exigir a loja: sem `_loja_id` válido, não retorna nada. Nenhuma outra tela usa essa função — ela existe só para o app público.

2. **Remover o seletor de lojas do app público.** A loja passa a vir exclusivamente de duas fontes: o `?loja=` do link ou a loja já usada naquele aparelho (guardada localmente). O colaborador nunca escolhe a loja numa lista.

3. **Tela de orientação quando abrir sem loja.** Se o app abrir pelo ícone e não houver loja no link nem no aparelho, mostrar uma tela clara: "Abra o link de reposição enviado pelo seu gerente" — em vez de qualquer lista. A loja gravada no aparelho é reaplicada na URL, então o ícone volta a funcionar normalmente depois do primeiro acesso pelo link.

4. **Sempre dados frescos ao abrir.** Ao abrir/retomar o app (inclusive voltando do segundo plano), revalidar loja, produtos, itens enviados e conferência, para não exibir informação velha em cache.

5. **Confirmação visível da loja.** Manter e reforçar o nome da loja no topo e antes de enviar, para o colaborador ter certeza da unidade.

## Detalhes técnicos

- Migração: `CREATE OR REPLACE FUNCTION public.get_lojas_public(_loja_id uuid DEFAULT NULL)` com `IF _loja_id IS NULL THEN RETURN; END IF;` (mantém assinatura e `SECURITY DEFINER` com `search_path = public`).
- `src/pages/AppFuncionariosPublic.tsx`: remover `lojaSelector` e os três pontos onde ele é renderizado; query `lojas-public` só habilitada com `selectedLojaId`; remover o auto-select por "única loja da lista"; adicionar estado de "sem loja" com instrução; `refetchOnWindowFocus`/`refetchOnMount` ativos nas queries do app público.
- Manifest: manter `start_url: "/reposicao"` (mudar não conserta atalhos já instalados); a recuperação passa pela loja persistida + tela de orientação.
- Depois de aplicar, quem já tem o ícone instalado deve abrir uma vez pelo link do WhatsApp para vincular a loja ao aparelho.

Verificação: teste real no navegador em 360px — abrir `/reposicao` sem parâmetro (deve mostrar a orientação, sem lista de lojas) e com `?loja=<id>` (deve funcionar normalmente).
