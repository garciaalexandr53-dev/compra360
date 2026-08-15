# App Reposição: tela branca e perda da lista

Dois problemas separados, confirmados no código:

1. **A lista digitada só existe na memória da aba.** Em `src/pages/AppFuncionariosPublic.tsx` os itens ficam num estado React (`items`) sem nenhuma cópia local. Qualquer recarregamento — atualizar a página, o navegador descartar a aba em segundo plano, ou o app se atualizar sozinho — apaga tudo e o funcionário recomeça do zero.
2. **Não existe nenhuma tela de erro.** O projeto não tem Error Boundary em lugar algum e a rota `/reposicao` é carregada com `Suspense fallback={null}`. Se algo falha ao renderizar ou o arquivo do app não baixa (rede fraca, versão nova publicada no meio do uso), o resultado é exatamente a tela branca sem retorno que ele viu.

A causa exata do erro que gerou a tela branca ainda não está identificada — hoje não há como saber, porque nada é registrado. O plano cobre as duas frentes: nunca mais perder a lista, e transformar a tela branca em uma tela com explicação e botão, além de deixar o erro registrado para diagnóstico.

## O que será feito

### 1. Lista salva no aparelho (não perde mais nada)
- Cada alteração da lista (adicionar, remover, ajustar) é gravada na hora no armazenamento local do celular, separada por loja.
- Ao abrir o app, se houver uma lista pendente daquela loja, ela volta automaticamente com um aviso discreto: "Sua lista foi recuperada — N itens".
- A lista local só é apagada depois do envio bem-sucedido, ou quando o funcionário toca em limpar.
- Rascunhos com mais de 3 dias são descartados na abertura, para não ressuscitar lista velha.

### 2. Tela branca vira tela de recuperação
- Novo Error Boundary envolvendo o app: em vez de branco, mostra "Algo deu errado ao abrir esta tela", a informação de que a lista foi salva, e os botões "Tentar de novo" e "Recarregar o app".
- O `Suspense` da rota `/reposicao` passa a mostrar um indicador de carregamento em vez de nada, para que "carregando" nunca pareça travamento.
- Falha no download do app (chunk) continua se auto-recuperando, mas agora com aviso visível quando a recuperação não resolve.

### 3. Registro do erro para diagnóstico
- O Error Boundary registra o erro no console com um marcador claro, para aparecer nos logs de diagnóstico na próxima vez que o problema acontecer no aparelho do cliente.

## Detalhes técnicos

- `src/pages/AppFuncionariosPublic.tsx`: `useEffect` de persistência de `items` em `localStorage` na chave `funcionarios_rascunho_<lojaId>` (payload `{ items, savedAt }`); hidratação no mount ligada à loja selecionada; limpeza em `enviar()` após insert OK e no "Enviar outra lista".
- Novo `src/components/ErrorBoundary.tsx` (class component com `componentDidCatch`), aplicado em `src/App.tsx` acima das rotas, com `reset()` que limpa o estado de erro sem recarregar.
- `src/App.tsx`: `Suspense fallback` da rota `/reposicao` passa a usar um spinner simples em vez de `null`.
- Nenhuma mudança em RPCs, tabelas, políticas ou no fluxo de envio para `itens_faltantes`.

## Verificação

- Playwright em 360px: adicionar itens, recarregar a página, confirmar que a lista volta com o aviso; enviar e confirmar que o rascunho é limpo.
- Forçar um erro de render em desenvolvimento para confirmar que aparece a tela de recuperação em vez de branco.
- Build e testes existentes verdes.
