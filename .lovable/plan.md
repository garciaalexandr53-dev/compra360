# Correção: "Erro: EAN inválido" ao enviar a lista de reposição (Mercado Olímpico)

## O que aconteceu
No vídeo, a funcionária toca em "Enviar 11 item(ns)" no App de Reposição e aparece "Erro: EAN inválido". Nenhum dos 11 itens é salvo, porque o envio é feito de uma vez só.

Na conferência do banco, o Catálogo Base tem 6 produtos com código de barras curto demais. São códigos internos e não um EAN real:

- Lamina Barbear Wilkinson Sword Com 3 (343077)
- Copo Termico Sunless Verao 24/25 Un (789363)
- Toten Display Sunless Verao 24/25 (789165)
- Marrom Glace Predilecta 1kg (24754)
- Peixe Salgado Saithe 7/9kg (7733)
- Querosene Petrus Jasmim 500ml (9639416)

Quando um desses produtos entra na lista, o app manda esse código junto. O banco só aceita códigos de 8 a 14 números, então recusa o envio inteiro. Na folha do vídeo aparece escrito "LAMINAS", o que indica que a lâmina Wilkinson estava entre os itens. Não consigo ver os 11 itens na tela para confirmar qual foi.

## Correção
1. **O app para de mandar código inválido.** Antes de enviar, qualquer código de barras que não tenha de 8 a 14 números é descartado. O item vai normalmente, só sem o código. Isso vale para itens do catálogo e para códigos digitados ou lidos pela câmera.
2. **Limpeza do catálogo.** Os 6 códigos curtos são apagados do Catálogo Base. Nome, embalagem e o resto do produto continuam iguais.
3. **Mensagem mais clara.** Se algum outro erro barrar o envio, a lista continua no celular e aparece "Não foi possível enviar. Sua lista foi mantida, tente de novo." no lugar do texto técnico.

## Para o Renato
Depois de publicado, a funcionária só precisa tocar em "Enviar" de novo. A lista dela continua salva no celular.

## Detalhes técnicos
- `AppFuncionariosPublic.tsx`: helper `eanValido(v) => /^\d{8,14}$/.test(v) ? v : null`, aplicado no `ean` dos inserts de `itens_faltantes` (envio da lista e `pendingEan`). Toast amigável no catch, sem limpar `items`.
- `run_sql`: `UPDATE catalogo_mestre SET ean = NULL WHERE ean IS NOT NULL AND ean !~ '^[0-9]{8,14}$'` (6 linhas; o log de auditoria registra a mudança). `produtos` já não tem códigos inválidos.
- A trigger `validar_item_faltante_publico` não muda: ela continua como proteção.
- Teste unitário para `eanValido`. tsgo e vitest verdes antes de publicar.
