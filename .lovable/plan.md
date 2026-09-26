# Horário de fechamento na mensagem do WhatsApp para o fornecedor

## O que muda para o usuário
Quando a cotação tem prazo definido, a mensagem enviada ao fornecedor ganha uma linha com o horário de fechamento:

```text
Olá Fornecedor X! Segue o link para cotação de preços:

https://compra360app.com.br/fornecedor/...

⏰ Fechamento da cotação: hoje até às 18:00

Preencha os preços e envie. Obrigado!
```

- Prazo hoje: "hoje até às HH:mm". Amanhã: "amanhã até às HH:mm". Outro dia: "dia DD/MM até às HH:mm".
- Sem prazo definido: mensagem fica exatamente como hoje (nenhuma linha extra).
- Prazo já vencido: a linha não aparece (evita confundir o fornecedor).
- Na mensagem de cobrança ("Vi que ainda não preencheu...") a mesma linha é incluída.

## Onde aparece
1. Fila de envio para todos os fornecedores (modal "Enviando cotação para fornecedores").
2. Envio e reenvio individual no Painel.
3. Tela de Links para fornecedores.
4. Botão de WhatsApp na tela de Fornecedores.

## O que NÃO muda
- Nenhuma alteração no banco, nas regras de prazo, no cronômetro do link do fornecedor ou na fila sequencial.
- Link, formato do telefone e abertura do WhatsApp continuam iguais.

## Detalhes técnicos
- Nova função pura `formatPrazoMensagem(iso, now?)` em `src/lib/format.ts` retornando a linha ou string vazia; testes em `src/lib/format.test.ts` (hoje, amanhã, outra data, nulo, vencido).
- `SendQueueModal.tsx`: nova prop opcional `prazoIso`, passada pelo `DashboardPage.tsx` a partir de `cotacaoAtiva.prazo_resposta`.
- `DashboardPage.tsx` (linhas ~536 e ~954): inserir a linha nas duas mensagens.
- `LinksPage.tsx` e `FornecedoresPage.tsx`: incluir `prazo_resposta` na consulta da cotação ativa da loja (somente leitura) e usar a linha na mensagem.
- Validação: tsgo + vitest verdes antes de publicar.
