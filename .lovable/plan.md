# Deixar a loja do link mais visível no app Funcionários

O link enviado já é único por loja (`/reposicao?loja=<id>`) e, quando o funcionário abre por ele, o seletor de loja nem aparece. O problema é de clareza: hoje o nome da loja aparece em letra pequena no cabeçalho e como uma linha discreta acima da busca — é fácil o funcionário não notar para qual loja está registrando.

## O que muda (apenas visual/texto)

1. **Cabeçalho fixo** (`AppFuncionariosPublic.tsx`)
   - Trocar a linha discreta pelo nome da loja em destaque: badge com fundo translúcido, ícone de local e o nome em negrito, logo abaixo do título "Compra360 Reposição".
   - Truncar com `truncate` para nomes longos e manter tudo legível em 360px (o badge de contagem de itens continua à direita).

2. **Faixa de contexto acima da busca**
   - Substituir a linha "Loja: X" por uma faixa clara: "Você está registrando itens para **<Loja>**" com ícone, fundo suave (`bg-primary/5`, borda `primary/20`).
   - Quando a loja veio pelo link, acrescentar texto curto: "Loja definida pelo link recebido."
   - Se não houver loja definida (caso raro sem link e com várias lojas), manter o comportamento atual de pedir a seleção.

3. **Confirmação antes de enviar**
   - No bloco do botão "Enviar", incluir uma linha acima do botão: "Enviando para **<Loja>**", para o funcionário conferir no momento decisivo.

4. **Tela de sucesso**
   - Reforçar a loja no resultado: "N item(ns) registrado(s) para **<Loja>**", em destaque em vez do texto secundário atual.

5. **Aba "Enviados"**
   - Manter o mesmo padrão de faixa de contexto, para o funcionário saber que o histórico é daquela loja.

## Fora de escopo

- Nenhuma mudança na lógica de loja, no link gerado, nas queries/RPCs, no rascunho local ou no envio.
- Nenhuma alteração na tela de Reposição do gestor (`FuncionariosPage`).

## Verificação

- Build verde e testes existentes rodando.
- Conferir visualmente em 360px e desktop: cabeçalho sem corte, faixa legível, botão de envio intacto.
