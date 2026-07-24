## Problema

No Dashboard, o botão **"Importar do ERP"** exige uma cotação ativa. Quando não há nenhuma, ele só mostra um toast e manda o usuário para a aba Cotação — mas lá também não existe um botão claro para "iniciar cotação vazia", então o fluxo trava.

O botão **"Montar manualmente"** não tem esse problema porque `/add-produtos` já cria a cotação automaticamente no primeiro item adicionado. Vamos aplicar o mesmo padrão ao ERP.

## Solução

Fazer o **"Importar do ERP"** iniciar a cotação sozinho quando não houver uma ativa — o usuário começa a cotação pela própria importação, sem precisar passar por outra tela.

### Mudanças (somente `src/pages/DashboardPage.tsx`)

1. No `onClick` do botão "Importar do ERP" (linha ~578):
   - Se `cotacaoAtiva?.id` existir → abre o modal como hoje.
   - Se não existir:
     - Validar que há `lojaAtiva?.id` (se não, toast pedindo para selecionar loja).
     - `INSERT` em `cotacoes` com `loja_id = lojaAtiva.id`, `status = "ativa"`, `nome = "Cotação " + data atual` (mesmo padrão usado em `handleNovaCotacao` e no manual).
     - Invalidar a query `["cotacao-ativa", ...]` para o `cotacaoAtiva` atualizar.
     - Abrir o `ImportErpModal` já com o novo `cotacao_id`.
   - Mostrar loading (`toast.loading` / desabilitar botão) durante a criação para não permitir clique duplo.

2. Ajustar a renderização do `ImportErpModal` (linha ~1008): passar o id recém-criado quando existir, para o modal abrir imediatamente após o insert (usar estado local `pendingCotacaoId` ou o próprio `cotacaoAtiva` já invalidado).

### Não muda

- Nenhuma mudança em `ImportErpModal.tsx` — ele continua recebendo `cotacaoId` como hoje.
- Fluxos "Importar itens faltantes" e "Montar manualmente" ficam iguais.
- Nenhum ajuste de backend / RLS / migrations.

### Verificação

- Sem cotação ativa: clicar em "Importar do ERP" cria a cotação e abre o modal na sequência; após importar, o Dashboard mostra a cotação com os itens.
- Com cotação ativa: comportamento atual preservado (abre modal direto).
- Sem loja ativa: toast pedindo para selecionar loja, sem criar cotação.
