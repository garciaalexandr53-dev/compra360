# Apresentação de Prospecção Compra360

## Resumo
Criar uma apresentação de vendas completa do Compra360 (fluxo de cotação do início ao fim) em **dois formatos**:
1. **PowerPoint (.pptx)** para download — editável, envia por e-mail/WhatsApp, abre no Google Slides.
2. **App de slides interativo** no preview do Lovable — apresenta ao vivo, exporta PDF pela rota de impressão.

Ambos compartilham o mesmo roteiro de ~20 slides e a identidade visual do Compra360 (teal + Sora, logo real).

## Roteiro de slides (~22)
1. **Capa** — Compra360 · Cotação inteligente para supermercados
2. **O problema** — cotação manual: tempo perdido, sem poder de negociação, erros de digitação
3. **A solução** — plataforma de cotação automatizada + 3 pilares (comparar, economizar, ganhar tempo)
4. **Como funciona** — 4 passos: Preparar → Cotar → Analisar → Pedir
5. **Passo 1: Configuração guiada** — onboarding (loja + fornecedores) em minutos
6. **Banco de produtos** — 11.500+ prontos, busca por nome/EAN, importar ERP/Excel
7. **Cadastro de fornecedores** — nome, pedido mínimo, prazo de pagamento, observações

**Seção dedicada — App de Funcionários** (demonstração passo a passo)

8. **Por que existe** — quem vê a falta na gôndola não é quem compra. A equipe registra, o comprador decide. Link por WhatsApp, sem instalar app, sem login.
9. **Demonstração: registrar item faltante** — 4 telas em sequência mostradas como mockups do fluxo real: abrir o link → buscar por nome ou código de barras (scanner da câmera) → informar quantidade, embalagem e observação → item enviado. Destaque: sugestão de embalagem/fator da equipe.
10. **Demonstração: comprador recebe** — tela de Itens Pendentes com badge "Sugestão da equipe", aceitar ou voltar ao padrão, e importação em 1 toque para a cotação ativa.
11. **Demonstração: conferência de recebimento** — a equipe confere o pedido recebido contra o pedido enviado, marca divergências de quantidade e o comprador vê o histórico de conferências.

12. **Passo 2: Cotação** — matriz de preços comparativa (produtos × fornecedores)
13. **Destaques inteligentes** — 🟢 MIN, 🟡 2º, ⚠️ erro de digitação, 🔴 sobrepreço
14. **Envio para fornecedores** — links/WhatsApp, status em tempo real, prazo de resposta
15. **Portal do fornecedor** — preenchimento simples pelo celular, aviso inteligente de preço
16. **Passo 3: Análise** — KPIs (total, cobertura, ranking), resumo automático
17. **Distribuição inteligente (IA)** — boost até 30%, puxar itens, negociar
18. **Pedidos otimizados** — agrupamento por fornecedor, envio por WhatsApp
19. **Histórico & insights** — ranking, variação de preços, relatórios consolidados
20. **Resultados** — 9,5% economia média + depoimentos reais de clientes
21. **Planos** — Gratuito / Pro / Business (benefícios por tier, **sem preços**)
22. **Próximos passos** — CTA: comece grátis / agende demo + contato


## Entrega 1 — PowerPoint (.pptx)

Gerado com **pptxgenjs** (skill pptx), salvo em `/mnt/documents`.

- **Paleta** (hex literal, pptxgenjs não usa tokens CSS): primário `#0E7C6B`, claro `#14B8A6`, accent `#5EEAD4`, fundo escuro `#0B2A26` (capa/encerramento), fundo claro `#F4FBFA` (conteúdo), texto escuro `#0F2A28`.
- **Fontes**: títulos "Trebuchet MS" (geométrico, amigável), corpo "Calibri". Sem Arial genérico.
- **Logo real**: embeda `public/compra360-icon.png` como base64 em capa e rodapé.
- **Motivo visual**: cartões arredondados com borda lateral teal + ícones em círculos teal; barras de progresso dos 4 passos. Sem linhas de acento sob títulos.
- **Tipografia**: título 40-54pt, corpo 20-24pt, stat callouts 60-80pt (legível em projeção).
- **Mockups de tela**: os slides de demonstração (App de Funcionários, matriz de cotação, portal do fornecedor) usam mockups de celular desenhados com shapes do pptxgenjs — moldura arredondada, barra de status e conteúdo fiel às telas reais. Sem capturas de tela desatualizadas.
- **Cada slide tem um elemento visual** (ícone/shape/diagrama) — nenhum slide só-texto.
- **Conteúdo factual**: só dados reais (11.500+, 9,5%, depoimentos existentes, planos sem preço). Sem métricas inventadas.
- **QA**: validar schema com `validate_document.py --auto-repair`, extrair texto com markitdown, converter em imagens (LibreOffice→PDF→pdftoppm) e inspecionar cada slide — corrigir overflow/sobreposição até passar.

## Entrega 2 — App de slides (React)

Antes de criar, verificar se já existe scaffold de slides (`SlideLayout`/`ScaledSlide`/`--slide-*`). Este é um app SaaS, então quase certamente não existe — construirei um **visualizador de apresentação focado** (não editor completo).

- **Rota**: `/apresentacao` adicionada ao `App.tsx`, com link discreto no AppLayout/Dashboard.
- **Renderização**: slides 1920×1080 com escala via `transform: scale()` e tipografia semântica `.slide-*` (tokens `--slide-*` em `index.css`), conforme guia slides-app.
- **Design tokens**: reaproveita `--primary`, `--brand`, `--accent` do projeto (teal) — sem hex cru. Logo via `<img src={withAssetVersion("/compra360-icon.png")}>`.
- **Conteúdo**: cada slide é um componente React (`Slide01Capa`, …) com o mesmo roteiro do .pptx, em pt-BR.
- **Toolbar**: logo, contador de slide, botões Apresentar (fullscreen) / Visão grade / tema claro-escuro.
- **Navegação**: URL-driven (`/apresentacao?slide=N`), setas/Space, `document.title` sincronizado.
- **Modo apresentação**: Fullscreen API, fundo preto, cursor oculto após inatividade, ESC sai.
- **Visão grade**: thumbnails de todos os slides, clique navega.
- **Export PDF**: rota `?print` renderiza slides empilhados, `@page 1920×1080 landscape`, `Cmd+P → Salvar PDF`.
- **Sem** notas de apresentador/broadcast/time real — fora do escopo de prospecção.

## Escopo (NÃO fazer)
- Não alterar funcionalidades existentes do SaaS.
- Não inventar números, clientes ou citações — só dados verificáveis.
- Não adicionar preços nos planos da apresentação.

## Ordem de execução
1. Gerar e validar o `.pptx` (Entrega 1) → inspecionar todas as imagens → corrigir → entregar em `/mnt/documents`.
2. Construir o app de slides (Entrega 2) → verificar 360px e desktop → publicar.

## Validação
- `.pptx`: schema validado, texto conferido, cada slide inspecionado visualmente.
- App de slides: typecheck verde, layout verificado em mobile 360px e desktop.
