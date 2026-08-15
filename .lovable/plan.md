# App Reposição: impedir novo erro durante o uso

O endereço publicado está abrindo normalmente agora, e o recarregamento recuperou a lista marcada. Portanto, a persistência do rascunho está funcionando.

O erro exato lançado no celular ainda não pode ser identificado: o Error Boundary atual registra somente no console do aparelho. Porém, foi confirmado no código que o PWA procura atualização a cada minuto, força a ativação da nova versão e recarrega quando ela assume o controle. Essa troca automática pode interromper uma sessão ativa e invalidar arquivos carregados, especialmente durante uma publicação ou em rede móvel instável.

## O que será feito

### 1. Não interromper uma lista em andamento
- Alterar o ciclo de atualização do PWA para não ativar uma versão nova nem recarregar automaticamente enquanto o App Reposição está aberto.
- A atualização ficará disponível para a próxima abertura/recarregamento seguro, sem trocar arquivos no meio da marcação dos itens.
- Manter a atualização automática atual nas demais áreas somente onde ela não interromper o trabalho em andamento.

### 2. Recuperação robusta de falha de arquivo
- Centralizar a identificação de falhas de carregamento de módulos/chunks.
- Fazer uma única tentativa controlada de limpar caches e recarregar, evitando ciclos de reload e evitando que a tela de erro apareça por uma troca de versão recuperável.
- Se a tentativa não resolver, manter a tela de recuperação atual com a lista preservada.

### 3. Tornar o próximo erro diagnosticável
- Salvar no aparelho um registro sanitizado do último erro: mensagem, tipo, rota, horário e indicação de falha de carregamento.
- Na tela de recuperação, exibir um código curto de diagnóstico e uma ação para copiar os detalhes, sem incluir itens da lista, dados pessoais ou conteúdo do rascunho.
- Manter o log no console para desenvolvimento.

### 4. Fortalecer a restauração do rascunho
- Validar cada item recuperado antes de colocá-lo no estado React, descartando somente entradas inválidas em vez de derrubar a tela inteira.
- Preservar a separação por loja e o prazo atual de 3 dias.

## Detalhes técnicos

- `src/main.tsx`: separar o comportamento de atualização da rota `/reposicao`, remover ativação/reload forçados durante a sessão e unificar a recuperação de chunks com trava persistente por versão.
- `src/App.tsx`: ajustar `retryImport` para delegar à recuperação controlada, sem reload incondicional concorrente.
- `src/components/ErrorBoundary.tsx`: persistir metadados sanitizados e mostrar código copiável de diagnóstico.
- `src/pages/AppFuncionariosPublic.tsx`: validar o schema do rascunho antes da hidratação; nenhuma alteração no envio para `itens_faltantes`.
- Sem mudanças em tabelas, RPCs, políticas ou dados do cliente.

## Verificação

- Simular falha de chunk e confirmar uma única recuperação, sem loop.
- Simular troca de Service Worker durante uma lista ativa e confirmar que a tela não é interrompida.
- Em 360px: adicionar itens, provocar erro, recarregar e confirmar a recuperação integral da lista.
- Testar rascunho parcialmente corrompido: itens válidos voltam e entradas inválidas são ignoradas.
- Validar desktop e build/testes relevantes.