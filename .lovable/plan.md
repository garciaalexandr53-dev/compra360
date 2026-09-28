# Correção: "Erro: EAN inválido" ao enviar a lista de reposição (Mercado Olímpico)

## O que aconteceu
No vídeo, a funcionária toca em "Enviar 11 item(ns)" no App de Reposição e aparece "Erro: EAN inválido". Nenhum dos 11 itens é salvo, porque o envio é feito de uma vez só.

O banco hoje só aceita códigos de barras com 8 a 14 números. Mas existem produtos reais com código menor: códigos internos, de balança e de fornecedor. No Catálogo Base há 6 desses:

- Lamina Barbear Wilkinson Sword Com 3 (343077)
- Copo Termico Sunless Verao 24/25 Un (789363)
- Toten Display Sunless Verao 24/25 (789165)
- Marrom Glace Predilecta 1kg (24754)
- Peixe Salgado Saithe 7/9kg (7733)
- Querosene Petrus Jasmim 500ml (9639416)

Quando um deles entra na lista, o envio inteiro é recusado. A folha do vídeo tem "LAMINAS" escrito, então a lâmina Wilkinson provavelmente estava na lista. Não dá para ver os 11 itens na tela para confirmar.

## Correção
1. **Aceitar códigos curtos.** A regra passa a aceitar códigos de 4 a 14 números. Ela continua recusando letras e textos estranhos. Os 6 códigos do catálogo ficam como estão, e novos produtos com código curto também vão passar.
2. **Um código ruim nunca mais barra a lista.** Se chegar um código fora do padrão (com letra, por exemplo), o item vai normalmente, só sem o código, em vez de recusar os 11 itens.
3. **Mensagem mais clara.** Se outro erro impedir o envio, a lista continua no celular e aparece "Não foi possível enviar. Sua lista foi mantida, tente de novo."

## Para o Renato
Depois de publicado, a funcionária só precisa tocar em "Enviar" de novo. A lista dela continua salva no celular.

## Detalhes técnicos
- Migração: em `validar_item_faltante_publico`, trocar o `RAISE 'EAN inválido'` por `NEW.ean := NULLIF(regexp_replace(NEW.ean,'\s','','g'),'')` e, se não bater `^[0-9]{4,14}$`, fazer `NEW.ean := NULL` sem lançar erro.
- `AppFuncionariosPublic.tsx`: helper `normalizarEan` com a mesma regra, aplicado nos inserts de `itens_faltantes`. Toast amigável no catch, sem limpar `items`.
- Conferir se a busca por EAN do funcionário e do Catálogo Mestre tem a mesma trava de 8 dígitos e alinhar para 4 a 14.
- Nenhum dado do catálogo é alterado.
- Teste unitário para `normalizarEan`. tsgo e vitest verdes antes de publicar.
