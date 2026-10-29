# Primeiro acesso: deixar claro o próximo passo depois do App Funcionários

## Problema
No Painel, o cartão "Sua equipe pode registrar o que está faltando" parece uma pendência obrigatória. O comprador envia o link, volta para o Painel e não sabe o que fazer, porque o cartão continua lá até a equipe registrar algum item.

## O que muda
1. **App Funcionários vira opcional e some depois do envio**
   - O texto do cartão passa a dizer que é opcional ("Opcional: sua equipe pode registrar o que está faltando").
   - Assim que o comprador envia o link na tela App Funcionários, o cartão sai do Painel (fica salvo neste aparelho).
   - O botão X para dispensar continua.

2. **Próximo passo em destaque no cartão do topo**
   - Para quem ainda não fez nenhuma cotação (já tem fornecedores, mas ainda não tem produtos), o cartão "Próximo passo" mostra:
     - **Fornecedores prontos! Agora adicione seus primeiros produtos**
     - "Adicione 2 ou 3 itens manualmente ou suba sua lista do ERP para disparar sua primeira cotação."
     - Botão principal: **Adicionar produtos**
   - Se ainda não houver fornecedores, continua aparecendo o aviso com **Fornecedores** em destaque.
   - Se a equipe já registrou faltas, mantém o atual "Importar itens faltantes".

3. **Ao voltar do App Funcionários**
   - Depois de enviar o link, a tela App Funcionários mostra um aviso curto: "Link enviado! Quando sua equipe registrar, os itens aparecem aqui. Enquanto isso, adicione produtos para sua primeira cotação", com o botão **Adicionar produtos**.

## O que não muda
Avisos do teste grátis, planos, CNPJ, fornecedores, importação de faltas, reposição e o fluxo de quem já faz cotações.

## Detalhes técnicos
- `AppFuncionariosDiscoveryCard.tsx`: título "Opcional", ocultar também quando `localStorage` tiver a marca de link enviado.
- `FuncionariosPage`: ao enviar/copiar link, gravar a marca e mostrar o aviso com atalho para `/add-produtos`.
- `DashboardPage.tsx` (`cockpitAcao`, estado 1): nova variação para usuário sem cotação anterior e com fornecedores, regra extraída para função pura em `src/lib` com teste Vitest.
- Validar com `tsgo`, Vitest e no navegador em tela de celular.
