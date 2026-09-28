# Conferência Física Limpa no Recebimento (App de Funcionários)

Objetivo: deixar a conferência de pedidos prática para quem recebe a mercadoria na doca — contagem física item a item, sem análise de preço de nota fiscal.

## Situação atual (verificada no código)

Na tela de conferência, cada item mostra hoje:
- Quantidade pedida e quantidade recebida (com botões − / +);
- Campo "Preço NF" para digitação manual, comparado ao preço cotado;
- Um ícone verde de "ok" automático, que aparece sempre que a quantidade bate — mesmo que a pessoa ainda não tenha contado aquele item;
- Botão "Tudo correto" e botão "Finalizar Conferência", que já pergunta se as faltas vão para a lista de reposição.

Problema: quem confere não tem como validar preço de nota (imposto, ST, IPI, frete entram no valor) e não existe marcação de "já conferi este item" — é fácil se perder e esquecer produtos no caminhão.

## O que muda

### 1. Foco só no físico
- O campo de digitação "Preço NF" sai da tela do conferente.
- O preço cotado continua sendo gravado na conferência exatamente como hoje, para o comprador analisar no painel e no histórico de conferências. Nada se perde no registro.
- O item na tela fica com: nome do produto, embalagem/fator, quantidade pedida e quantidade recebida.

### 2. Marcação item a item
Cada item passa a ter um dos três estados:
- Pendente (cinza): ainda não foi contado.
- Conferido (verde): a pessoa confirmou que veio tudo certo.
- Com falta (âmbar): a quantidade recebida é menor que a pedida, com a falta destacada.

Botão "Conferir" em cada item para o caso de vir completo; mexer nos botões − / + ou no número já marca o item como conferido automaticamente (conferido ou com falta, conforme a quantidade).

### 3. Progresso visível no topo
- Barra de progresso com "32 de 35 conferidos".
- Selos rápidos: Conferidos, Com falta, Pendentes.
- Botão "Marcar todos como conferidos" (substitui o atual "Tudo correto") para carga que chegou 100% completa.
- Filtro rápido para ver só os pendentes, útil no fim da conferência.

### 4. Aviso ao finalizar
- Se sobrarem itens pendentes, aparece uma confirmação: "Ainda restam X itens não conferidos. Finalizar mesmo assim?".
- Com faltas, segue o fluxo atual: pergunta se envia as faltas para a lista de reposição da próxima cotação.

### 5. Faltas do pedido identificadas para o comprador
Hoje as faltas da conferência caem na mesma lista de reposição da equipe (tela Funcionários e "Importar itens faltantes" do Painel), misturadas com os itens bipados na prateleira, sem nenhuma marcação de origem. Além disso, entram sem embalagem e fator, o que pode fazer o item não casar com o produto na importação.

O que muda:
- Cada falta leva a origem: pedido, fornecedor e quem conferiu.
- Na lista de reposição e na importação para a cotação, o item mostra o selo "Faltou no pedido #12 · Atacadão" (âmbar), separado visualmente dos itens da equipe.
- A falta passa a levar a mesma embalagem e fator do pedido, para entrar certinho na próxima cotação.
- Se a mesma falta for enviada duas vezes, continua valendo a regra atual de juntar itens repetidos.

### 6. O que não muda
- Gravação da conferência, histórico de conferências no painel, faltas indo para a lista de reposição e o funcionamento do app público com o link da loja continuam iguais.
- A leitura por foto da nota (hoje desligada) continua desligada.

## Detalhes técnicos

- Arquivo principal: `src/components/ConferenciaPedidos.tsx`.
- `ConferenciaItem` ganha `conferido: boolean` (inicia `false`); `preco_nf` deixa de ser editável na interface e é enviado com o valor de `preco_cotado` no payload de `complete-conferencia` (contrato da função inalterado).
- `statusDoItem` passa a devolver `pendente` quando `!conferido` e não houver metadados de OCR; `divergencia` / `correto` seguem a regra atual para itens já conferidos.
- `markAllCorrect` passa a marcar `conferido: true` em todos os itens.
- `updateQtdRecebida` / `updateQtdRecebidaInput` marcam `conferido: true` no item alterado.
- `loadProgress` / `saveProgress`: normalizar `conferido` com fallback `false` para progresso salvo em versão anterior.
- `finalizarConferencia`: confirmação (AlertDialog) quando `statusPorItem` contiver `pendente`; observações continuam registrando a contagem de divergências.
- Faltas: `adicionarFaltantes` grava `embalagem`, `fator_embalagem` e `registrado_por` no formato `Conferência · Pedido #N · <fornecedor> · <conferente>` (sem usar `observacao`, que é lida pelos parsers de embalagem). Helper puro `origemFaltaConferencia(registrado_por)` em `src/lib/itensFaltantesImport.ts` (com teste) extrai pedido/fornecedor; `FuncionariosPage.tsx` e `ModalNovaCotacao.tsx` exibem o selo. Queries e importação existentes inalteradas.
- Sem migração de banco e sem alteração em RPCs ou funções de borda.
- Verificação: `tsgo` + `vitest` verdes antes de publicar.
