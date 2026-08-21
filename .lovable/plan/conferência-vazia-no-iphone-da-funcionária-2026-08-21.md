# Conferência vazia no iPhone da funcionária

## O que verifiquei

- Existem pedidos com status "enviado" e loja vinculada (ex.: BRAND VAREJÃO - CIANORTE, dezenas de pedidos).
- A função pública nova (`get_pedidos_conferencia_publico`) já está no banco e devolve 86 pedidos para essa loja.
- O código do app público (`ConferenciaPedidos` recebendo a loja do link) já está correto no projeto.

Ou seja: banco e código estão certos. O iOS em si não muda o funcionamento — a correção da Conferência foi feita depois da última publicação, então o link que a funcionária usa (domínio publicado) ainda está servindo a versão antiga, que lia as tabelas diretamente e voltava vazia. No iPhone isso tende a durar mais porque o Safari/PWA guarda a versão antiga com mais teimosia.

## O que será feito

1. **Publicar o app**, para o link da funcionária passar a servir a versão corrigida da Conferência.
2. **Aviso amigável quando a lista vier vazia por falta de contexto**: se o app abrir sem loja definida, a aba Conferência mostra a mesma orientação de "abra pelo link da sua loja" em vez de uma lista vazia sem explicação.
3. **Forçar atualização no iOS**: garantir que a Conferência recarregue ao abrir/retomar o app (revalidação em foco), para o iPhone não exibir cache antigo depois da publicação.
4. **Passo a passo para a funcionária** (texto pronto para você enviar): abrir o link novamente uma vez; se continuar vazio, fechar o app da tela inicial, reabrir pelo link e, se necessário, remover e adicionar o ícone de novo.

## Detalhes técnicos

- Nenhuma migração nova é necessária; as funções públicas por loja já existem e retornam dados.
- `src/components/ConferenciaPedidos.tsx`: no modo público sem `lojaId`, renderizar estado de orientação (sem consulta); manter `refetchOnWindowFocus` e adicionar revalidação ao voltar de background (`visibilitychange`).
- `src/pages/AppFuncionariosPublic.tsx`: sem alteração de lógica de loja; apenas garantir que a aba Conferência receba `lojaId` já resolvido (link ou aparelho).
- Verificação: em 360px, abrir `/reposicao?loja=4f787628-...` e confirmar a lista de pedidos; abrir `/reposicao` sem parâmetro e confirmar a orientação.
