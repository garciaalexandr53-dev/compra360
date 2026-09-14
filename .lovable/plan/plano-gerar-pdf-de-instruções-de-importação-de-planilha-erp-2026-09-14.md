# Plano: Gerar PDF de instruções de importação de planilha ERP

## Objetivo
Produzir um PDF formatado, pronto para enviar ao cliente, com a especificação completa do padrão de planilha aceito pela importação "Importar do ERP" do Compra360.

## Fonte da verdade
Os dados do PDF já foram confirmados lendo `src/components/ImportErpModal.tsx` e `ImportErpModal.test.tsx` (detecção de colunas, mapa de embalagens, comportamento de dedup, EAN).

## O que será gerado
Arquivo `instrucoes-importacao-erp.pdf` em `/mnt/documents/` (downloadável, visível no chat).

### Conteúdo do PDF
1. **Cabeçalho Compra360** — título "Importação de Lista do ERP — Guia de Formato".
2. **Formato do arquivo** — Excel (.xlsx, .xls) ou CSV (.csv, .txt); primeira linha = cabeçalho; separador CSV auto (; ou ,); decimal vírgula ou ponto; ordem das colunas irrelevante.
3. **Tabela de colunas** — Produto (obrigatória), Quantidade (opcional, padrão 1), Embalagem (opcional, padrão UNI), EAN (opcional) — com todos os nomes de cabeçalho aceitos.
4. **Tabela de valores de embalagem** — CX, FD, KG, PCT, UNI, DZ e as siglas/palavras que cada um aceita; valor desconhecido vira UNI.
5. **Como o sistema trata os itens** — EAN no catálogo mestre vs. produto local; itens repetidos consolidados (prevalece a última quantidade, não somam); nome idêntico para casar produto existente; sugestão automática de fator de embalagem por IA.
6. **Exemplo de CSV** — bloco com cabeçalho e linhas de exemplo.
7. **Dicas** — manter nomes idênticos, preferir EAN, embalagens em sigla ou extenso, comunicar cabeçalho diferente para inclusão.
8. **Rodapé** — suporte por WhatsApp da equipe + "© 2026 Compra360".

### Estilo
- pt-BR; fonte Unicode (DejaVu Sans via reportlab) para acentuação correta.
- Layout limpo: seções com título, tabelas com bordas, exemplo em fonte monoespaçada.
- Tons da marca (verde/escuro) nos títulos, sem exageros.

## Validação (QA obrigatório)
- Gerar o PDF com reportlab, converter cada página para imagem (`pdftoppm`), inspecionar todas.
- Verificar: acentuação correta, sem texto cortado/sobreposto, tabelas alinhadas, exemplo legível, sem caixas pretas de glifos ausentes.
- Corrigir e re-renderizar até passar limpo; então entregar via `<presentation-artifact>`.

## Fora de escopo
- Nenhuma alteração no código do projeto, banco, RLS ou Edge Functions.
- Não há alteração na lógica de importação — apenas documentação para o cliente.
