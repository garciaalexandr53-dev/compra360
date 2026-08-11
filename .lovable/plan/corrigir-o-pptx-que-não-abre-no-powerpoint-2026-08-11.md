# Corrigir o .pptx que não abre no PowerPoint

## Diagnóstico (confirmado)

Inspecionei o arquivo `Compra360-Apresentacao-Comercial.pptx` gerado anteriormente. O ZIP está íntegro e o texto/imagens estão todos lá, mas o índice interno do arquivo (`[Content_Types].xml`) declara 22 partes que **não existem** dentro do arquivo: `ppt/slideMasters/slideMaster2.xml` até `slideMaster23.xml` (só existe o `slideMaster1.xml`).

O PowerPoint valida esse índice ao abrir: parte declarada e ausente = arquivo rejeitado com "Não é possível abrir o arquivo". O LibreOffice e o markitdown são tolerantes, por isso a QA anterior passou sem detectar.

Causa: um master por slide foi declarado durante a geração (comportamento do pptxgenjs quando cada slide define seu próprio fundo/master), mas apenas um master foi realmente gravado.

## Correção

1. Ajustar o script de geração para não criar masters por slide — usar um único master e aplicar fundo/cores diretamente em cada slide.
2. Regerar o arquivo como `Compra360-Apresentacao-Comercial-v2.pptx` em `/mnt/documents` (mantendo o original intocado), com o mesmo conteúdo, roteiro e identidade visual atuais.
3. Garantir na gravação: `[Content_Types].xml` como primeira entrada do ZIP, sem entradas de diretório vazias, e nenhuma parte declarada sem arquivo correspondente.

## Verificação antes de entregar

- Checagem programática: toda parte declarada em `[Content_Types].xml` existe no pacote (é exatamente o teste que o arquivo atual falha).
- Validação de esquema com auto-repair.
- Conversão de todos os slides em imagens e inspeção visual de cada um (overflow, sobreposição, texto cortado, imagens faltando).
- Extração de texto para conferir ordem e conteúdo dos 23 slides.

## Observação

A apresentação interativa em `/apresentacao` no app continua funcionando e não é afetada — ela segue disponível como alternativa (inclusive exportando PDF pela rota de impressão).
