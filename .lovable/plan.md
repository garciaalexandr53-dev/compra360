# Correção: "Erro: EAN inválido" ao enviar a lista de reposição (Mercado Olímpico)

## O que a investigação mostrou
- A mensagem vem de uma regra do banco. Essa regra recusa o envio inteiro se **um único item** tiver código de barras fora de 8 a 14 números. Por isso nenhum dos 11 itens foi salvo.
- Hoje a loja enviou 4 listas sem erro (10:42, 11:16, 11:20 e 12:27). Só a lista do vídeo falhou, então o problema está em algum item dela, e não no app ou na loja.
- Os itens que aparecem no vídeo (abacaxi, abridor, Always, esponja Scotch-Brite, Veja, Paçoquita, chocolates Nestlé e Lacta) estão todos com código certo ou sem código. Eles não causaram o erro.
- A lista tinha 11 itens, e o vídeo mostra só parte deles. Um dos itens escondidos tem o código fora do padrão. O servidor não guardou o registro da tentativa, então não dá para saber qual foi.

## Três caminhos por onde um código ruim entra (todos serão fechados)
1. **Produto do catálogo com código curto.** Existem produtos reais com código menor, como a Lâmina Wilkinson (343077), o Querosene Petrus (9639416) e o Peixe Saithe (7733): são 6 no total. A folha da funcionária tem "LAMINAS" escrito, então esse é o suspeito mais provável.
2. **Número digitado na busca.** Se a funcionária digita qualquer número com 8 ou mais dígitos e toca em "Adicionar como novo", esse número vira código, mesmo com 15 dígitos ou mais.
3. **Leitura pela câmera.** Algumas etiquetas de caixa têm códigos longos (mais de 14 números), e a câmera lê esses códigos inteiros.

## Correção
1. **Aceitar códigos curtos.** A regra passa a aceitar de 4 a 14 números. O catálogo não é alterado.
2. **Código fora do padrão nunca mais barra a lista.** O item é salvo normalmente, só sem o código. Isso vale nos três caminhos: catálogo, digitação e câmera.
3. **Mensagem clara e lista preservada.** Se outro erro impedir o envio, a lista continua no celular e aparece "Não foi possível enviar. Sua lista foi mantida, tente de novo."

## Para o Renato
Depois de publicado, a funcionária só precisa tocar em "Enviar" de novo. A lista dela continua salva no celular.

## Detalhes técnicos
- Migração: em `validar_item_faltante_publico`, trocar o `RAISE 'EAN inválido'` por normalização. Tirar os espaços; se não bater `^[0-9]{4,14}$`, fazer `NEW.ean := NULL`, sem lançar erro.
- `AppFuncionariosPublic.tsx`: helper `normalizarEan` com a mesma regra, aplicado ao `ean` de todos os inserts de `itens_faltantes`. `termoEhEan` limitado a 4 a 14 dígitos. Toast amigável no catch, sem limpar `items`.
- Conferir se o scanner e a busca por EAN do Catálogo Mestre usam a mesma faixa e alinhar para 4 a 14.
- Teste unitário para `normalizarEan`. tsgo e vitest verdes antes de publicar.
