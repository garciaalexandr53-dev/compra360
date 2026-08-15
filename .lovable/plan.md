# Corrigir o erro do leitor de código de barras

Com a informação de que o erro acontece sempre no mesmo ponto — usando o leitor de código —, a causa está no componente do scanner (`src/components/shared/BarcodeScannerModal.tsx`), não em atualização de versão. A hipótese de atualização está descartada.

## O que está errado

1. **A tela é destruída no meio da leitura.** Quando o código é reconhecido, o próprio código chama, dentro da função de retorno da biblioteca de leitura, o preenchimento da busca e o fechamento do modal ao mesmo tempo (`onDetected(code)` seguido de `onClose()`, linhas 55-56). Isso remove da tela o elemento onde a biblioteca ainda está desenhando o vídeo, enquanto ela continua rodando. A biblioteca e o React passam a disputar os mesmos elementos, e a remoção falha com erro — exatamente a tela "Algo deu errado ao abrir esta tela". Por ser sempre a mesma sequência, o erro se repete no mesmo ponto.

2. **A câmera é reiniciada sem necessidade.** O efeito que liga a câmera depende das funções `onDetected` e `onClose` (linha 88). No App Reposição essas funções são recriadas a cada digitação, então a câmera é parada e ligada repetidamente durante o uso. Isso multiplica a chance de a parada e o início se cruzarem e agrava o problema acima.

3. **A parada da câmera não é aguardada.** A limpeza dispara parar/limpar sem esperar a conclusão, então a leitura pode continuar depois de a tela já ter sido desmontada.

## Correção na origem

### 1. Encerrar a câmera antes de fechar
- Ao reconhecer um código, primeiro parar a leitura por completo e só depois entregar o código e fechar o modal.
- O fechamento deixa de acontecer dentro da função de retorno da biblioteca, evitando desmontar a tela enquanto a leitura está ativa.
- Trava para aceitar apenas a primeira leitura, evitando entregas duplicadas.

### 2. Isolar o elemento do vídeo do controle do React
- O elemento onde a biblioteca desenha o vídeo passa a ser um contêiner estável, criado e limpo de forma controlada, e não mais alternado por classe/condição de renderização enquanto a câmera está ativa.
- Assim React e biblioteca deixam de disputar os mesmos elementos, que é o que gera o erro de remoção.

### 3. Não reiniciar a câmera a cada digitação
- As funções de retorno passam a ser lidas por referência, e o efeito passa a depender apenas de abrir/fechar e da tentativa manual de "Tentar de novo".
- A câmera liga uma vez ao abrir e desliga uma vez ao fechar.

### 4. Encerramento seguro e sem erro solto
- A sequência de parada é aguardada, com tratamento próprio, e qualquer falha de parada é tratada silenciosamente em vez de derrubar a tela.
- Falha real de câmera continua caindo nas telas já existentes de permissão negada, sem câmera ou erro de leitura.

### 5. Deixar o próximo erro identificável
- O Error Boundary passa a mostrar um código curto do erro e a mensagem técnica resumida, sem itens da lista nem dados pessoais, para que qualquer nova falha seja identificada de imediato em vez de investigada por dedução.

## Detalhes técnicos

- `src/components/shared/BarcodeScannerModal.tsx`: reescrever o ciclo de vida do scanner — `stop()`/`clear()` aguardados antes de `onDetected`/`onClose`; callbacks em `useRef`; dependências do efeito reduzidas a `open` e `attempt`; contêiner do vídeo com `ref` estável e sem alternância condicional enquanto ativo.
- `src/components/shared/SearchInputComScanner.tsx`: garantir identidade estável do `onDetected` repassado.
- `src/components/ErrorBoundary.tsx`: exibir mensagem/código do erro capturado.
- Nenhuma alteração no envio para `itens_faltantes`, nas RPCs, na busca por nome/EAN ou na persistência do rascunho.

## Verificação

- Reproduzir o cenário do erro em navegador com câmera simulada e código EAN válido, confirmando que a leitura fecha o modal, preenche a busca e não gera exceção.
- Abrir e fechar o leitor várias vezes seguidas, e digitar no campo de busca com o leitor aberto, confirmando que a câmera não é reiniciada.
- Testar permissão negada e ausência de câmera, confirmando as telas de fallback.
- Mobile 360px e desktop; build e testes existentes.
