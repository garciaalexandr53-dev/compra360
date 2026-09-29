export type SlideTone = "ok" | "warn" | "bad" | "muted";

export interface SlideCard {
  icon: string;
  title: string;
  text: string;
}

export interface SlideStat {
  value: string;
  label: string;
}

export interface SlideStep {
  n: string;
  title: string;
  text: string;
}

export interface PhoneRow {
  label: string;
  value?: string;
  tone?: SlideTone;
}

export interface PhoneMock {
  header: string;
  rows: PhoneRow[];
  caption: string;
}

export interface Slide {
  id: string;
  variant?: "cover" | "section" | "content" | "closing";
  kicker?: string;
  title: string;
  subtitle?: string;
  paragraphs?: string[];
  bullets?: { title: string; text?: string; tone?: SlideTone }[];
  cards?: SlideCard[];
  stats?: SlideStat[];
  steps?: SlideStep[];
  phones?: PhoneMock[];
  matrix?: boolean;
  quote?: { text: string; author: string };
  plans?: { name: string; items: string[] }[];
  note?: string;
}

export const slides: Slide[] = [
  {
    id: "capa",
    variant: "cover",
    kicker: "Apresentação comercial",
    title: "Compra360",
    subtitle: "Cotação inteligente para supermercados",
    note: "compra360app.com.br",
  },
  {
    id: "problema",
    kicker: "O cenário de hoje",
    title: "A cotação manual custa caro",
    bullets: [
      { title: "Tempo perdido", text: "Ligações, planilhas e mensagens soltas para cada fornecedor." },
      { title: "Sem poder de negociação", text: "Sem comparação lado a lado, o preço aceito é o primeiro que chega." },
      { title: "Erros de digitação", text: "Um preço errado passa direto e vira prejuízo no pedido." },
      { title: "Nada fica registrado", text: "Sem histórico, não há como saber se o preço de hoje é bom." },
    ],
  },
  {
    id: "solucao",
    kicker: "A solução",
    title: "Uma plataforma para todo o ciclo de compra",
    cards: [
      { icon: "Scale", title: "Comparar", text: "Todos os fornecedores na mesma matriz, produto por produto." },
      { icon: "PiggyBank", title: "Economizar", text: "O melhor preço destacado automaticamente em cada item." },
      { icon: "Clock", title: "Ganhar tempo", text: "Envio, resposta e pedido em um fluxo só, pelo WhatsApp." },
    ],
  },
  {
    id: "como-funciona",
    kicker: "Visão geral",
    title: "Como funciona",
    steps: [
      { n: "1", title: "Preparar", text: "Loja, fornecedores e a lista de itens." },
      { n: "2", title: "Cotar", text: "Fornecedores respondem pelo celular." },
      { n: "3", title: "Analisar", text: "Compare preços e cobertura." },
      { n: "4", title: "Pedir", text: "Pedidos por fornecedor no WhatsApp." },
    ],
  },
  {
    id: "onboarding",
    kicker: "Passo 1 · Preparar",
    title: "Configuração guiada em minutos",
    bullets: [
      { title: "Assistente de 5 etapas", text: "Cadastra a loja e os primeiros fornecedores." },
      { title: "Só o essencial", text: "Nome do fornecedor basta; o resto é opcional." },
      { title: "Sem cadastrar produtos", text: "O catálogo já vem pronto." },
    ],
  },
  {
    id: "catalogo",
    kicker: "Passo 1 · Preparar",
    title: "Banco de produtos pronto",
    stats: [
      { value: "11.500+", label: "produtos disponíveis" },
      { value: "Nome ou EAN", label: "busca híbrida" },
      { value: "ERP / Excel", label: "importação da sua lista" },
    ],
    note: "A busca reconhece nome e código de barras — nada precisa ser digitado do zero.",
  },
  {
    id: "fornecedores",
    kicker: "Passo 1 · Preparar",
    title: "Fornecedores do seu jeito",
    bullets: [
      { title: "Cadastro simples", text: "Nome, WhatsApp e, se quiser, e-mail." },
      { title: "CNPJ oficial em 1 clique", text: "Razão social, nome fantasia e situação vêm da Receita Federal." },
      { title: "Regras comerciais", text: "Pedido mínimo, prazo de pagamento e observações." },
      { title: "Por loja", text: "Cada unidade com sua própria lista de fornecedores." },
    ],
  },
  {
    id: "secao-rede",
    variant: "section",
    kicker: "Seção",
    title: "Rede de Fornecedores",
    subtitle: "Fornecedores que já entregam na sua cidade, prontos para cotar com você.",
  },
  {
    id: "rede-como",
    kicker: "Rede de Fornecedores",
    title: "Você não começa do zero",
    cards: [
      { icon: "Network", title: "Sugestões da região", text: "A plataforma mostra parceiros que atendem a cidade da sua loja." },
      { icon: "Store", title: "Adicionar em 1 clique", text: "O cadastro vira uma cópia sua, com pedido mínimo e prazo preenchidos." },
      { icon: "ShieldCheck", title: "Sigilo total", text: "Nenhum fornecedor vê quais supermercados cotam com você." },
    ],
  },
  {
    id: "rede-desempenho",
    kicker: "Rede de Fornecedores",
    title: "Saiba com quem vale cotar",
    bullets: [
      { title: "Taxa de resposta", text: "Quantas das últimas cotações o fornecedor respondeu.", tone: "ok" },
      { title: "Fornecedor ágil", text: "Selo para quem costuma responder rápido.", tone: "ok" },
      { title: "Novo na rede", text: "Parceiro recém-cadastrado, ainda sem histórico.", tone: "muted" },
      { title: "Cidades atendidas", text: "Só aparece quem realmente entrega na sua região." },
    ],
  },
  {
    id: "secao-funcionarios",
    variant: "section",
    kicker: "Seção",
    title: "App de Funcionários",
    subtitle: "Quem vê a falta na gôndola registra. O comprador decide.",
  },
  {
    id: "funcionarios-porque",
    kicker: "App de Funcionários",
    title: "Por que existe",
    bullets: [
      { title: "Sem instalar aplicativo", text: "A equipe abre um link enviado pelo WhatsApp." },
      { title: "Sem login", text: "Nenhuma senha para gerenciar no salão de vendas." },
      { title: "O comprador no controle", text: "A equipe sugere; a decisão de compra continua com você." },
    ],
  },
  {
    id: "funcionarios-registrar",
    kicker: "Demonstração",
    title: "A equipe registra o item faltante",
    phones: [
      {
        header: "Reposição",
        rows: [
          { label: "Buscar produto", value: "arroz", tone: "muted" },
          { label: "Arroz Tipo 1 5kg", tone: "ok" },
          { label: "Ler código de barras", tone: "muted" },
        ],
        caption: "Busca por nome ou leitor de código de barras da câmera.",
      },
      {
        header: "Novo item",
        rows: [
          { label: "Quantidade", value: "10" },
          { label: "Embalagem", value: "Fardo 6un" },
          { label: "Observação", value: "acabou na gôndola", tone: "muted" },
        ],
        caption: "Quantidade, embalagem e observação em uma tela.",
      },
      {
        header: "Enviado",
        rows: [
          { label: "Item registrado", tone: "ok" },
          { label: "Vai para o comprador", tone: "muted" },
          { label: "Registrar outro item", tone: "muted" },
        ],
        caption: "Confirmação imediata e volta para registrar o próximo.",
      },
    ],
  },
  {
    id: "funcionarios-comprador",
    kicker: "Demonstração",
    title: "O comprador recebe",
    phones: [
      {
        header: "Itens pendentes",
        rows: [
          { label: "Arroz Tipo 1 5kg", value: "10", tone: "ok" },
          { label: "Sugestão da equipe", tone: "warn" },
          { label: "Óleo de Soja 900ml", value: "24" },
        ],
        caption: "Cada item chega marcado como sugestão da equipe.",
      },
      {
        header: "Revisar",
        rows: [
          { label: "Embalagem sugerida", value: "Fardo 6un", tone: "warn" },
          { label: "Aceitar sugestão", tone: "ok" },
          { label: "Voltar ao padrão", tone: "muted" },
        ],
        caption: "Aceite a sugestão ou volte ao padrão do cadastro.",
      },
      {
        header: "Importar",
        rows: [
          { label: "Selecionados", value: "12" },
          { label: "Importar para a cotação", tone: "ok" },
        ],
        caption: "Um toque leva os itens para a cotação ativa.",
      },
    ],
  },
  {
    id: "funcionarios-conferencia",
    kicker: "Demonstração",
    title: "Conferência cega do recebimento",
    phones: [
      {
        header: "Conferir",
        rows: [
          { label: "Pedido enviado", value: "10 fardos" },
          { label: "Recebido", value: "8 fardos", tone: "warn" },
          { label: "Divergência", value: "-2", tone: "bad" },
        ],
        caption: "A equipe confere quantidade sem ver nenhum preço negociado.",
      },
      {
        header: "Embalagem",
        rows: [
          { label: "Caixa com 12un", value: "3 caixas" },
          { label: "Total em unidades", value: "36", tone: "ok" },
          { label: "Ajustar fator", tone: "muted" },
        ],
        caption: "Caixas, fardos e unidades convertidos sem conta na mão.",
      },
      {
        header: "Faltou",
        rows: [
          { label: "Itens com divergência", value: "3", tone: "warn" },
          { label: "Enviar para reposição", tone: "ok" },
          { label: "Histórico por fornecedor", tone: "muted" },
        ],
        caption: "O que faltou vai para a próxima lista em um toque.",
      },
    ],
  },
  {
    id: "matriz",
    kicker: "Passo 2 · Cotar",
    title: "Matriz comparativa de preços",
    matrix: true,
    note: "Produtos nas linhas, fornecedores nas colunas. O melhor preço aparece destacado.",
  },
  {
    id: "destaques",
    kicker: "Passo 2 · Cotar",
    title: "Destaques que evitam erro",
    bullets: [
      { title: "Melhor preço", text: "O menor valor de cada item fica em destaque.", tone: "ok" },
      { title: "Segundo melhor", text: "A alternativa mais próxima, para negociar.", tone: "warn" },
      { title: "Possível erro de digitação", text: "Valores fora do padrão são sinalizados.", tone: "warn" },
      { title: "Sobrepreço", text: "Preços muito acima da referência ganham alerta.", tone: "bad" },
    ],
  },
  {
    id: "envio",
    kicker: "Passo 2 · Cotar",
    title: "Envio para os fornecedores",
    bullets: [
      { title: "Link individual", text: "Cada fornecedor recebe o seu link por WhatsApp." },
      { title: "Status em tempo real", text: "Você vê quem abriu, quem respondeu e quem falta." },
      { title: "Horário de fechamento", text: "A mensagem já avisa a data e a hora limite para enviar preços." },
      { title: "Contagem regressiva", text: "O prazo aparece para você e para o fornecedor, sem cobrança manual." },
    ],
  },
  {
    id: "portal",
    kicker: "Passo 2 · Cotar",
    title: "Portal do fornecedor",
    phones: [
      {
        header: "Cotação",
        rows: [
          { label: "Arroz Tipo 1 5kg", value: "R$ 24,90" },
          { label: "EAN 789...", tone: "muted" },
          { label: "Óleo de Soja 900ml", value: "R$ 6,40" },
        ],
        caption: "Preenchimento direto no celular, sem login.",
      },
      {
        header: "Aviso de preço",
        rows: [
          { label: "Preço informado", value: "R$ 249,00", tone: "bad" },
          { label: "Confira o valor digitado", tone: "warn" },
        ],
        caption: "Aviso inteligente quando o valor foge da referência.",
      },
      {
        header: "Enviar",
        rows: [
          { label: "Itens preenchidos", value: "38/40", tone: "ok" },
          { label: "Não tenho o item", tone: "muted" },
          { label: "Enviar preços", tone: "ok" },
        ],
        caption: "Botão explícito para itens que ele não atende.",
      },
    ],
  },
  {
    id: "analise",
    kicker: "Passo 3 · Analisar",
    title: "Análise da cotação",
    cards: [
      { icon: "BarChart3", title: "Total por fornecedor", text: "Quanto sai com cada um e no cenário combinado." },
      { icon: "PieChart", title: "Cobertura", text: "Quantos itens cada fornecedor atende de fato." },
      { icon: "Trophy", title: "Ranking", text: "Quem venceu mais itens nesta cotação." },
    ],
  },
  {
    id: "distribuicao",
    kicker: "Passo 3 · Analisar",
    title: "Distribuição inteligente",
    bullets: [
      { title: "Menos fornecedores", text: "Concentra o pedido e mostra exatamente o que mudou e por quê." },
      { title: "Puxar itens", text: "Move itens entre fornecedores para bater o pedido mínimo." },
      { title: "Negociar", text: "Sugere onde pedir desconto, com base no segundo melhor preço." },
    ],
    note: "Toda movimentação é explicada — nada acontece sem você entender o motivo.",
  },
  {
    id: "pedidos",
    kicker: "Passo 4 · Pedir",
    title: "Pedidos prontos para enviar",
    bullets: [
      { title: "Agrupados por fornecedor", text: "Itens, quantidades e embalagens já organizados." },
      { title: "Envio pelo WhatsApp", text: "Mensagem montada, um fornecedor após o outro." },
      { title: "Registro do envio", text: "Fica gravado o que foi pedido e quando." },
    ],
  },
  {
    id: "historico",
    kicker: "Depois da compra",
    title: "Histórico e insights",
    bullets: [
      { title: "Todas as cotações", text: "Consulta por período, loja e fornecedor." },
      { title: "Variação de preços", text: "Compare o preço de hoje com as cotações anteriores." },
      { title: "Relatórios", text: "Exportação consolidada em Excel." },
    ],
  },
  {
    id: "resultados",
    kicker: "Resultados",
    title: "O que os clientes veem",
    stats: [
      { value: "9,5%", label: "economia média por cotação" },
      { value: "11.500+", label: "produtos no catálogo" },
      { value: "Multi-loja", label: "cada unidade com seus dados" },
    ],
    quote: {
      text: "Antes eu levava a tarde inteira ligando para fornecedor. Agora comparo tudo na tela e fecho o pedido no WhatsApp.",
      author: "Cliente Compra360",
    },
  },
  {
    id: "multiloja",
    kicker: "Para redes",
    title: "Uma loja ou várias filiais",
    bullets: [
      { title: "Painel único", text: "Troque de loja sem sair do sistema." },
      { title: "Dados separados", text: "Cada filial com seus fornecedores, produtos e histórico." },
      { title: "Link certo para cada equipe", text: "O app da equipe abre travado na loja do funcionário." },
      { title: "Cotação por filial", text: "Compare e feche pedidos unidade por unidade." },
    ],
  },
  {
    id: "planos",
    kicker: "Planos",
    title: "Escolha o tamanho da sua operação",
    plans: [
      { name: "Gratuito", items: ["Cotações essenciais", "Catálogo completo", "1 loja"] },
      { name: "Pro", items: ["Análise avançada", "Histórico e relatórios", "App de Funcionários"] },
      { name: "Business", items: ["Multi-loja", "Recursos com IA", "Prioridade no suporte"] },
    ],
    note: "Valores atualizados apresentados na proposta comercial.",
  },
  {
    id: "cta",
    variant: "closing",
    kicker: "Próximos passos",
    title: "Comece grátis hoje",
    subtitle: "Ou agende uma demonstração com sua lista de produtos real.",
    note: "compra360app.com.br",
  },
];
