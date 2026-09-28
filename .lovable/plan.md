# Várias empresas no mesmo WhatsApp e vários representantes por CNPJ

## O problema de hoje
O cadastro na Rede (/seja-parceiro) barra qualquer WhatsApp que já existe. O representante que passa a atender uma nova empresa não consegue cadastrá-la, e uma distribuidora não pode ter dois vendedores.

## Nova regra (WhatsApp = pessoa, CNPJ = empresa)

```text
Mesmo WhatsApp + mesmo CNPJ        -> barra: "Essa empresa já está no seu cadastro" + link para atualizar
Mesmo WhatsApp + CNPJ novo         -> permite: nova empresa agregada do mesmo representante
Mesmo WhatsApp + sem CNPJ          -> barra (pede o CNPJ para diferenciar as empresas)
WhatsApp novo  + CNPJ já na Rede   -> permite: mais um representante da mesma empresa (o anterior continua ativo)
WhatsApp novo  + CNPJ novo         -> cadastro normal (como hoje)
```

- Nunca sobrescreve nem apaga o cadastro de outro representante.
- Toda empresa nova passa pelo mesmo código de 4 dígitos confirmado pelo WhatsApp.

## Tela de cadastro (/seja-parceiro)
- Ao digitar um WhatsApp já cadastrado, o aviso amarelo muda para: "Você já tem N empresa(s) na Rede: X, Y. Para cadastrar outra empresa, informe o CNPJ dela abaixo."
- O CNPJ passa a ser obrigatório só nesse caso (quando o número já existe). Continua opcional para quem entra pela primeira vez.
- O nome da empresa continua vindo da Receita.

## Área do parceiro (/parceiro)
- Ao entrar com o WhatsApp, se ele tiver mais de uma empresa, aparece a lista das empresas dele. Ele escolhe qual quer atualizar (cidades, linhas, prazo).
- Botão "Cadastrar outra empresa" leva ao cadastro com o WhatsApp já preenchido.
- O botão "Não represento mais esta empresa" fica para o próximo item da lista (Portal e limpeza da Rede).

## Sugestões para os supermercados
- Hoje as sugestões juntam cadastros pelo telefone. Com várias empresas no mesmo número, isso esconderia uma delas. O agrupamento passa a ser por telefone + CNPJ: cada empresa do representante aparece separada, e dois vendedores da mesma empresa também aparecem separados, cada um com suas cidades.
- Nada muda nos fornecedores que as lojas já copiaram para a sua carteira.

## O que não muda
Fluxo do link da cotação, consentimento, cópia ao "Adicionar à loja", desempenho do fornecedor e o Painel Admin.

## Detalhes técnicos
- `cadastrar_fornecedor_parceiro`: trocar a checagem por `right(fone,10)` por fone_key + cnpj (via `fornecedor_cnpj_key`); retornar `ja_cadastrado` só para mesmo fone+CNPJ; `cnpj_obrigatorio` quando fone existe e CNPJ vazio.
- `whatsapp_parceiro_existe`: devolver também a lista de empresas (nome, CNPJ mascarado parcialmente).
- `solicitar_acesso_parceiro` / confirmação de código: após validar, devolver a lista de tokens+nomes das empresas do mesmo fone_key; `ParceiroPage` mostra seletor quando houver mais de uma. `get_parceiro_dados`/`salvar_parceiro_dados` continuam por token (sem mudança).
- `sugerir_fornecedores_por_cidade` e `copiar_fornecedores_para_loja`: chave de grupo passa a `fone_key || '|' || COALESCE(cnpj_key,'')` (com fallbacks atuais). Replicação de dados do portal limitada ao mesmo fone+CNPJ.
- Tudo via uma migração; RPCs SECURITY DEFINER com `search_path = public`; mesmos GRANTs atuais.
- Testes: casos da tabela de regras na lógica de front e ajuste do teste de agrupamento. tsgo + vitest verdes antes de publicar.
