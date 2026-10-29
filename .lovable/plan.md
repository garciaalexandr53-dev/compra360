# Primeiro acesso sem fricção (Fase 1)

Objetivo: o novo cliente chega rápido ao sistema e entende como funciona uma cotação, sem perder nenhum dado importante (nome, WhatsApp, CNPJ, validação do teste grátis).

## Parte 1 — Cadastro
- A tela de criar conta passa a pedir **Nome**, além de e-mail, senha e WhatsApp.
- A janela "Como podemos te chamar?" deixa de aparecer para quem já informou o nome no cadastro. Ela continua aparecendo só para contas antigas que ainda não têm nome (nada se perde).

## Parte 2 — Assistente de configuração
**Passo da loja (CNPJ primeiro)**
- O primeiro campo é o CNPJ (continua obrigatório para validar o teste grátis).
- Ao digitar, o sistema busca na Receita e preenche automaticamente: nome fantasia (ou razão social quando não houver fantasia), endereço completo, cidade e estado.
- Todos os campos continuam editáveis depois do preenchimento.
- Se a consulta falhar, o cliente preenche à mão, como hoje.

**Passo de fornecedores**
- Deixa de ser obrigatório. Vira um passo só informativo, igual ao de produtos: explica que as cotações chegam no WhatsApp dos fornecedores e que ele cadastra depois.

**Passo de produtos**
- Mantido como está (informativo).

**Passo final — Demonstração**
- Apresentação guiada e visual do caminho completo de uma cotação: lista no App Funcionários, envio pelo WhatsApp, fornecedores preenchendo preços, comparação automática e pedidos prontos enviados.
- Usa apenas exemplos fictícios na tela; não cria nada na loja do cliente, não envia mensagens e não conta como cotação.
- Pode ser pulada e revista depois.

## Parte 3 — Tela inicial (Painel) sem fornecedores
- Quando o cliente terminou o assistente e ainda não tem fornecedor, aparece no Painel:
  "Você ainda não cadastrou nenhum fornecedor. Acesse a aba **Fornecedores** para conferir parceiros pré-cadastrados na sua região ou cadastrar os seus."
- A palavra **Fornecedores** em cor de destaque, clicável, com uma setinha discreta (sem ícone de caminhão), levando direto à aba Fornecedores.
- Some sozinha assim que existir o primeiro fornecedor.

## O que NÃO muda
- Avisos de teste grátis e planos, pagamentos, validação de CNPJ e proteção anti-abuso.
- Fluxo de cotação de quem já usa o sistema.
- Rede de Fornecedores e regras de privacidade entre clientes.

## Ordem de execução
1. Parte 1 (cadastro com nome).
2. Parte 2 — CNPJ primeiro com preenchimento automático.
3. Parte 2 — fornecedor opcional + aviso no Painel (Parte 3).
4. Parte 2 — demonstração final.
Cada etapa validada (tipos, testes e navegador) antes da próxima.

## Detalhes técnicos
- Nome salvo no perfil no momento do cadastro (metadados de signup + gravação no perfil); `ModalBoasVindas` condicionado a perfil sem nome.
- Reaproveitar a consulta existente em `src/lib/cnpj.ts`; mapear `nome_fantasia || razao_social`, logradouro, número, bairro, município, UF, CEP.
- `OnboardingWizard.tsx`: remover a obrigatoriedade do fornecedor; contexto persistido mantido.
- Demonstração como componente isolado com dados estáticos, sem consultas ao banco.
- Aviso do Painel baseado na contagem de fornecedores da loja ativa.
- Testes Vitest para: mapeamento do CNPJ, regra de exibição do aviso sem fornecedores, regra de exibição do modal de nome.
