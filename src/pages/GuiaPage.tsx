import { BookOpen, Package, Users, BarChart3, Link2, ShoppingCart, TrendingUp, History, UserCheck, AlertTriangle, CheckCircle } from "lucide-react";

const sections = [
  {
    icon: BookOpen,
    title: "O que é o Compra360?",
    color: "text-primary",
    content: `O Compra360 é um sistema de cotação de preços desenvolvido para **reduzir custos de compras**, **aumentar o poder de negociação**, **padronizar o processo de cotação** e **economizar tempo do comprador**.

Com ele, você cadastra produtos, envia links para fornecedores preencherem os preços, compara automaticamente e gera pedidos otimizados.`,
  },
  {
    icon: Package,
    title: "1. Banco de Produtos",
    color: "text-blue-600",
    content: `**Primeiro passo:** cadastre todos os produtos que sua empresa compra.

- **Adicionar manualmente:** clique em "+ Novo Produto" e preencha nome, embalagem e categoria.
- **Importação em massa:** use o botão "Importar" para colar texto, enviar CSV ou arquivo Excel (.xlsx). O sistema detecta colunas automaticamente e remove duplicados.
- **Edição inline:** clique em qualquer campo (nome, embalagem) diretamente na lista para editar.
- **Filtro por categoria:** use a barra lateral para filtrar por categoria.
- **Ativar para cotação:** o toggle "Ativo" inclui/remove o produto da cotação atual.`,
  },
  {
    icon: Users,
    title: "2. Fornecedores",
    color: "text-purple-600",
    content: `Cadastre os fornecedores com dados completos:

- **Nome, telefone, e-mail, representante**
- **Pedido mínimo** — valor mínimo para realizar um pedido
- **Prazo de pagamento** — ex: "30 dias", "À vista"
- **Observações** — notas internas sobre o fornecedor

Cada fornecedor recebe um **token único** usado para gerar o link de cotação.`,
  },
  {
    icon: UserCheck,
    title: "3. App Funcionários",
    color: "text-indigo-600",
    content: `Funcionalidade para **funcionários reportarem itens em falta** sem precisar acessar o sistema principal.

- Acesse pelo link **/app-funcionarios** (pode ser enviado via WhatsApp)
- O funcionário busca no banco de produtos existente ou adiciona manualmente
- Informa **quantidade, embalagem e observações**
- Na tela administrativa (menu "App Funcionários"), o comprador pode **importar os itens diretamente para a cotação ativa**`,
  },
  {
    icon: BarChart3,
    title: "4. Cotação (Matriz de Preços)",
    color: "text-emerald-600",
    content: `A tela principal do sistema. Exibe uma **grade comparativa** com todos os produtos × fornecedores.

**Destaques automáticos:**
- 🟢 **MIN** — menor preço (verde)
- 🟡 **2º** — segundo menor preço (amarelo)
- 🟠 **▲** — preço 25%+ acima da média (possível sobrepreço)
- 🔵 **▼** — preço 25%+ abaixo da média (possível erro de digitação, unidade ou cotação incorreta)

**Edição:** todos os campos são editáveis diretamente na tabela (nome, embalagem, quantidade, preço).

**Nova Cotação:** salva o histórico e reinicia — você pode manter a lista de itens ou zerar tudo.`,
  },
  {
    icon: Link2,
    title: "5. Links para Fornecedores",
    color: "text-cyan-600",
    content: `Gere e envie links individuais para cada fornecedor preencher os preços.

- **Link direto:** cada fornecedor tem um link único com seu token
- **WhatsApp:** botão de envio rápido com mensagem pré-formatada
- **Status em tempo real:** veja quais fornecedores já responderam (indicador verde)
- O fornecedor acessa uma página simples e preenche apenas os preços`,
  },
  {
    icon: TrendingUp,
    title: "6. Resumo",
    color: "text-amber-600",
    content: `Dashboard com **KPIs gerais** da cotação:

- **Total da compra** — soma dos menores preços × quantidades
- **Cobertura** — percentual de itens que receberam ao menos um preço
- **Fornecedores que responderam**
- **Ranking por fornecedor** — quantidade de itens com menor preço, total do pedido potencial e barra de performance`,
  },
  {
    icon: ShoppingCart,
    title: "7. Pedidos",
    color: "text-rose-600",
    content: `Após analisar a cotação, gere pedidos otimizados:

- O sistema agrupa automaticamente os itens vencedores por fornecedor
- Cada pedido inclui: **produto, quantidade, embalagem, preço unitário, subtotal**
- **Envio por WhatsApp:** mensagem formatada com todos os detalhes + prazo de pagamento
- Acompanhe o status: rascunho → enviado → confirmado`,
  },
  {
    icon: History,
    title: "8. Histórico",
    color: "text-gray-600",
    content: `Consulte cotações anteriores:

- **Lista de cotações** finalizadas com data e quantidade de itens
- **Busca por item** — pesquise um produto específico e veja como o preço evoluiu ao longo das cotações
- **Restaurar** — reabra uma cotação antiga se necessário`,
  },
];

const GuiaPage = () => {
  return (
    <div className="max-w-3xl mx-auto p-5 pb-20">
      <div className="text-center mb-8">
        <img src="/logo-compra360.png" alt="Compra360" className="w-14 h-14 rounded-2xl shadow-lg mx-auto mb-4" />
        <h1 className="text-2xl font-extrabold text-foreground">Guia do Compra360</h1>
        <p className="text-sm text-muted-foreground mt-1">Como usar o sistema passo a passo</p>
      </div>

      {/* Workflow visual */}
      <div className="flex items-center justify-center gap-1 mb-8 flex-wrap text-xs font-bold">
        {["Preparar", "Cotar", "Analisar", "Pedir"].map((step, i) => (
          <div key={step} className="flex items-center gap-1">
            <span className="bg-primary text-primary-foreground px-3 py-1.5 rounded-full">{i + 1}. {step}</span>
            {i < 3 && <span className="text-muted-foreground">→</span>}
          </div>
        ))}
      </div>

      <div className="space-y-6">
        {sections.map((section) => (
          <div key={section.title} className="bg-card border rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <section.icon className={`h-5 w-5 ${section.color}`} />
              <h2 className="text-base font-bold text-foreground">{section.title}</h2>
            </div>
            <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {section.content.split(/\*\*(.*?)\*\*/g).map((part, i) =>
                i % 2 === 1 ? <strong key={i} className="text-foreground">{part}</strong> : part
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Tips */}
      <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <h3 className="text-sm font-bold text-amber-800">Dicas Importantes</h3>
        </div>
        <ul className="text-sm text-amber-700 space-y-2">
          <li>• Sempre verifique preços com o indicador <strong className="text-blue-600">▼</strong> (muito abaixo) — podem ser erros de digitação ou unidade errada.</li>
          <li>• Preços com <strong className="text-orange-600">▲</strong> (muito acima) indicam possibilidade de negociação.</li>
          <li>• Envie o link do App Funcionários para toda a equipe — quanto mais itens reportados, melhor a cotação.</li>
          <li>• Use o Histórico para comparar preços entre cotações e identificar tendências.</li>
        </ul>
      </div>

      <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <h3 className="text-sm font-bold text-green-800">Fluxo Recomendado</h3>
        </div>
        <ol className="text-sm text-green-700 space-y-1.5 list-decimal list-inside">
          <li>Cadastre produtos e fornecedores</li>
          <li>Funcionários reportam itens em falta pelo App</li>
          <li>Importe os itens faltantes para a cotação</li>
          <li>Envie os links para os fornecedores</li>
          <li>Acompanhe as respostas em tempo real</li>
          <li>Analise o resumo e gere os pedidos</li>
          <li>Envie os pedidos via WhatsApp</li>
        </ol>
      </div>
    </div>
  );
};

export default GuiaPage;
