# Cidade, estado e CEP da loja

## Objetivo
Registrar a localização da loja (cidade, UF e CEP) no cadastro e mostrar essa informação nos pedidos enviados aos fornecedores.

## O que muda para você

### Cadastro / edição de loja
- Novos campos abaixo de Endereço: **Cidade** (obrigatória), **Estado (UF)** e **CEP**.
- Cidade e UF em uma linha (UF curta, 2 letras, em maiúsculas), CEP em campo próprio com máscara `00000-000`.
- Não é possível salvar uma loja sem cidade; ao editar uma loja antiga sem cidade, o campo aparece vazio e precisa ser preenchido para salvar.

### Detalhes da loja
- O painel de detalhes passa a exibir "Cidade", "Estado" e "CEP" junto dos dados cadastrais.

### Pedido enviado ao fornecedor
- Nos dados de faturamento da mensagem, logo abaixo do endereço, entra a linha:
  `📍 Cidade: São Paulo - SP` e `🏷️ CEP: 05127-174` (cada uma só aparece se preenchida).
- A mesma informação aparece na pré-visualização dos dados de faturamento na tela, antes do envio.

## Detalhes técnicos

1. **Banco**: migração adicionando à tabela `lojas` as colunas `cidade text`, `uf text` e `cep text` (todas nulas para não quebrar registros existentes). Sem mudança de RLS/grants.
2. **`src/components/lojas/lojaUtils.ts`**: novos campos em `Loja`, `LojaForm`, `emptyLojaForm`; helpers `formatCEP` e `formatUF`, além de `formatCidadeUF(loja)` retornando `"Cidade - UF"`. Testes adicionados em `lojaUtils.test.ts`.
3. **`LojaEditModal.tsx`**: campos Cidade/UF (grid 2 colunas) e CEP com máscara; botão Salvar desabilitado sem cidade; validação com trim e limites de tamanho (cidade 100, UF 2, CEP 9).
4. **`src/pages/LojasPage.tsx`**: incluir os três campos no payload de insert/update (cidade obrigatória, UF em maiúsculas, CEP apenas se preenchido) e no preenchimento do formulário de edição.
5. **`LojaSheet.tsx`**: linhas de Cidade, Estado e CEP nos dados cadastrais.
6. **Mensagem do pedido** — mesma adição nos três pontos que montam os dados de faturamento: `src/pages/AnalisePage.tsx`, `src/pages/PedidosPage.tsx` e `src/components/analise/PedidosContent.tsx` (linhas do WhatsApp + bloco de pré-visualização). Mantida a codificação atual da URL.
7. **`useLojaAtiva.tsx`**: incluir `cidade`, `uf` e `cep` na interface `Loja` para uso nas mensagens.
8. Nenhuma alteração em consultas/mutações existentes além dos campos novos. Verificação: typecheck, testes e revisão visual em 360px e desktop.
