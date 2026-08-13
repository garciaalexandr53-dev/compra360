# One-pager PDF de follow-up — Compra360

## Objetivo
Um PDF de **1 página**, em pt-BR, para enviar ao possível cliente logo após o primeiro contato (e-mail ou WhatsApp). Explica o que é o Compra360, como funciona e o impacto no dia a dia do comprador. Sem preços.

## Estrutura da página (A4 retrato)

1. **Topo** — logo Compra360 + linha de posicionamento: "Cotação inteligente para supermercados".
2. **Faixa de abertura (equilibrada)** — três números/argumentos lado a lado:
   - 9,5% de economia média na compra
   - Cotação pronta em minutos, não em horas de planilha e WhatsApp
   - 11.500+ produtos já cadastrados, sem trabalho de cadastro
3. **Como funciona** — 4 passos em faixa horizontal: Preparar → Cotar → Analisar → Pedir, com uma linha explicativa cada.
4. **O dia a dia muda assim** — bloco "Antes × Depois" em duas colunas:
   - Antes: preços por WhatsApp, planilha manual, erro de digitação, sem histórico.
   - Depois: fornecedor preenche pelo celular, comparação automática, alerta de preço fora do padrão, pedidos por WhatsApp em 1 toque, histórico de preços.
5. **A equipe também participa** — app de reposição por link (sem instalar nada, sem login): equipe registra falta na gôndola e confere o recebimento; o comprador decide.
6. **Rodapé** — CTA "Comece grátis" + site compra360app.com.br e espaço para contato do vendedor.

## Regras de conteúdo
- Só dados verificáveis já usados na landing page (9,5%, 11.500+ produtos). Nada inventado.
- Nenhum preço de plano; menciona apenas que há teste gratuito.
- Linguagem direta de supermercado ("gôndola", "comprador", "pedido mínimo"), sem jargão técnico.

## Detalhes técnicos
- Gerado com **reportlab** (Python), fonte Unicode DejaVu Sans registrada via `fc-match` para acentuação correta.
- Paleta teal da marca (mesma do PowerPoint): `#0E7C6B`, `#14B8A6`, `#5EEAD4`, fundo claro `#F4FBFA`, texto `#0F2A28`.
- Logo real embutido de `public/compra360-icon.png`.
- Saída: `/mnt/documents/compra360-one-pager.pdf`, entregue com tag de artefato para download.
- **QA obrigatório**: renderizar em imagem com `pdftoppm` e inspecionar — corrigir estouros, sobreposições, corte de texto e contraste até a página passar limpa. Garantir que caiba em 1 página.

## Fora do escopo
- Não altera nenhum arquivo do sistema (nenhuma rota, componente ou estilo do app).
- Não gera carrossel, texto de WhatsApp nem página web (podem vir depois se quiser).
