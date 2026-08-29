# Mostrar o nome da pessoa no contato com o cliente

Hoje o painel admin e as mensagens de contato usam o nome da **loja** (ou o e-mail) como se fosse a pessoa. O nome pessoal já existe no cadastro de perfil (verificado no banco: 7 dos 20 perfis têm nome preenchido), mas ele nunca é carregado no painel.

## O que muda

1. **Painel administrativo passa a trazer o nome da pessoa**
   A consulta que lista os clientes passa a retornar também o nome pessoal do perfil.

2. **Identificação em duas linhas nas listas e no detalhe**
   Onde hoje aparece só "Mercado Olímpico" (ou o e-mail), passa a aparecer:
   - linha principal: **nome da pessoa** (quando existir)
   - linha secundária: nome da empresa + e-mail
   Se a pessoa não tiver nome cadastrado, mantém o comportamento atual (empresa, senão e-mail). Vale para: lista de clientes, aba Alertas, aba Contatos, sheets de métricas e o cabeçalho do modal de contato.

3. **Mensagens de WhatsApp e e-mail passam a chamar pelo primeiro nome**
   A saudação passa a usar o primeiro nome da pessoa ("Olá, Alexandre!"). Quando não houver nome, cai para o nome da empresa e, por último, para o e-mail — como hoje.

4. **Detalhe do cliente mostra os dois dados**
   No sheet de detalhes, campos separados: "Responsável" (nome pessoal) e "Empresa" (loja principal).

5. **Busca do painel também procura pelo nome da pessoa**, além de empresa, e-mail e CNPJ.

## Observação importante

Clientes antigos que nunca preencheram o nome continuarão aparecendo pela empresa — não há como inventar o dado. O nome é pedido no modal de boas-vindas e editável no Perfil; ele será preenchido conforme os clientes acessarem.

## Detalhes técnicos

- Migração: `CREATE OR REPLACE FUNCTION public.admin_list_clientes()` acrescentando a coluna `nome_contato text` (subselect em `public.profiles`), mantendo `is_admin()` e `search_path = public`.
- `src/lib/adminHelpers.ts`: campo `nome_contato: string | null` no tipo `Cliente`; helper `getNomeExibicao(c)` (nome → loja → e-mail) e `getPrimeiroNome(c)`; `getMensagem()` passa a usar o primeiro nome na saudação.
- Consumidores atualizados: `src/pages/AdminPage.tsx` (lista + filtro de busca), `src/components/admin/AlertasTab.tsx`, `ContatosTab.tsx`, `MetricSheets.tsx`, `ClienteDetalhesSheet.tsx`, `ContatoModal.tsx`.
- Testes em `src/lib/adminHelpers.test.ts` cobrindo a cadeia de fallback do nome e a saudação das mensagens.
- Layout verificado em 360px e desktop; truncamento preservado nas duas linhas.
