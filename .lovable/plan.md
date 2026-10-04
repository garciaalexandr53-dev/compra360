# Gerador de Proposta Comercial (Painel Admin)

## Objetivo
Nova aba **"Propostas"** no Painel Administrativo (grupo Financeiro) onde o administrador preenche os dados do supermercado e baixa, em 1 clique, um **PDF de 1 página** pronto para enviar no WhatsApp do decisor.

## 1. Formulário (preenchimento em ~30 segundos)
- **Cliente:** nome do supermercado/rede, nome do decisor, cidade/UF, WhatsApp do decisor.
- **Operação:** número de lojas (1 a 10), itens por cotação, cotações por semana.
- **Modelos de preço prontos (editáveis):**
  - Pro (1-2 lojas): anual R$ 1.188 à vista; mensal R$ 119
  - Rede 3-5 lojas (recomendado): anual R$ 2.490 à vista; mensal R$ 290 + R$ 500 de implantação
  - Rede 6-10 lojas: anual R$ 3.990 à vista; mensal R$ 450 + R$ 800 de implantação
  - Qualquer valor pode ser alterado à mão.
- **Fechamento:** validade (padrão 7 dias), chave Pix, WhatsApp de contato (padrão 44 98448-3553).
- Os últimos dados digitados ficam salvos no aparelho para não perder ao recarregar.

## 2. Prévia e ações
- Cartão de prévia com resumo da proposta, atualizado enquanto digita.
- **Baixar PDF** (1 página).
- **Copiar mensagem para WhatsApp** — texto curto de acompanhamento com os pontos principais.
- **Abrir WhatsApp do decisor** com a mensagem pronta (se o número foi informado).

## 3. Conteúdo do PDF (A4, 1 página)
1. Cabeçalho: logo Compra360, número da proposta (AAAAMMDD-HHMM), data e validade.
2. "Preparado para": rede, decisor, cidade/UF, número de lojas.
3. O que está incluso: cotação centralizada para todas as lojas, equalização de preços e pedido mínimo, envio sequencial de listas e pedidos via WhatsApp, importação de planilhas do ERP com memória de formato, conferência física no recebimento, implantação, treinamento e suporte via WhatsApp.
4. Impacto estimado: horas economizadas por mês (calculadas a partir de lojas × cotações × itens) e tempo de fechamento por cotação antes e depois.
5. Investimento: dois blocos lado a lado — **Anual à vista (recomendado)**, com implantação grátis e economia no 1º ano em destaque, e **Mensal**, com taxa de implantação.
6. Rodapé: validade com data final, chave Pix, contato.

## Detalhes técnicos
- Novo `src/components/admin/PropostaComercialTab.tsx`, registrado em `NAV_GROUPS` de `AdminPage.tsx` (`value: "propostas"`, ícone FileText). O controle de acesso do admin já existente é mantido.
- Novo `src/lib/propostaComercial.ts`: presets, cálculos puros (economia anual vs mensal, horas economizadas, data de validade, número da proposta) e montagem do texto de WhatsApp.
- Novo `src/lib/propostaComercialPdf.ts`: jsPDF (já instalado), reutilizando o logo usado em `historicoExports.ts`; layout de posição fixa com fonte reduzida automaticamente para garantir 1 página.
- Sem banco de dados nesta versão (nada é gravado na nuvem).
- Testes em `src/lib/propostaComercial.test.ts`: economia do anual (ex.: mensal 290×12 + 500 − 2.490 = R$ 1.490), validade de 7 dias, horas economizadas.
- Verificação: tsgo, vitest e geração real do PDF convertida em imagem para conferir que cabe em 1 página.
