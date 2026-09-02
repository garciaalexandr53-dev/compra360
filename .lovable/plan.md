# Painel Administrativo — navegação em Sidebar Vertical

## Problema
O `AdminPage.tsx` usa uma única `TabsList` horizontal com **9 abas** (`grid-cols-9` desktop / `grid-cols-3` mobile). Isso polui a tela, mistura áreas de natureza diferente e não escala conforme o admin cresce. Barra estática horizontal é bom até ~5 itens; para 9+ o padrão da indústria é sidebar vertical.

## Solução
Substituir a barra horizontal de abas por uma **sidebar vertical** interna à área do admin, com agrupamentos por domínio. Conteúdo de cada seção passa a ser renderizado por `activeTab` (já existe o estado) em vez do componente `Tabs`.

> Nota de contexto: o `/admin` já é renderizado dentro do `AppLayout` (que tem a `AppSidebar` principal à esquerda no desktop). Esta sidebar é **interna** à página admin — uma sub-navegação de seções, padrão comum em dashboards (ex.: área de configurações com sidebar próprio). Não há conflito: a sidebar do app mostra o fluxo (Painel, Produtos, Fornecedores…); a sidebar do admin mostra as seções administrativas.

### Estrutura de layout
```
<header sticky>  (mantém: voltar, título, Atualizar)
<main max-w-7xl>
  <div className="flex gap-6 items-start">
    <aside>  ← sidebar vertical (desktop) / chip-bar (mobile)
    <section className="flex-1 min-w-0">  ← conteúdo da seção ativa
  </div>
</main>
```

### Sidebar (desktop, md+)
`<aside className="hidden md:block w-56 shrink-0 sticky top-20 self-start space-y-4">`

Itens agrupados com rótulos (uppercase, muted), cada item é um botão de largura cheia com ícone + label. Item ativo: `bg-primary/10 text-primary font-medium`; inativo: `text-muted-foreground hover:bg-muted/60 hover:text-foreground`.

```
VISÃO GERAL
  ◽ Métricas          (LayoutDashboard / Activity)
  ◽ Alertas           (AlertTriangle)

CLIENTES
  ◽ Clientes          (Users)
  ◽ Contatos          (MessageCircle)

FINANCEIRO
  ◽ Pagamentos        (CreditCard)

COMUNICAÇÃO
  ◽ E-mails           (Mail)

CATÁLOGO
  ◽ Catálogo          (Package)
  ◽ Candidatos        (PackagePlus)
  ◽ Histórico         (History)
```

Os 3 de produto ficam **separados** (não colapsados num sub-menu), pois a sidebar tem espaço vertical de sobra — mais rápido de acessar que um aninhamento.

### Mobile (–md)
A sidebar vira uma **barra horizontal rolável** de chips logo abaixo do header:
`<div className="md:hidden flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-2 sticky top-14 bg-background/95 backdrop-blur z-10">`
Cada chip = botão com ícone + label, ativo com `bg-primary text-primary-foreground`. Sem rótulos de grupo no mobile (só a lista de chips, na mesma ordem). Rolagem horizontal evita estouro a 360px.

### Renderização do conteúdo
- Remover `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`.
- Manter `const [activeTab, setActiveTab] = useState("metricas")`.
- `<section>` renderiza condicionalmente por `activeTab`:
  - `"metricas"` → bloco de métricas atual
  - `"alertas"` → `<AlertasTab />`
  - `"clientes"` → bloco de clientes atual
  - `"pagamentos"` → `<PagamentosTab />`
  - `"contatos"` → `<ContatosTab />`
  - `"emails"` → `<EmailsTab />`
  - `"catalogo"` → `<CatalogoTab />`
  - `"candidatos"` → `<CandidatosTab />`
  - `"historico"` → `<HistoricoCatalogoTab />`
- Lógica interna de cada bloco, queries, mutations, sheets e modais (`MetricSheets`, `ContatoModal`, `ClienteDetalhesSheet`, AlertDialogs) **permanecem idênticos** — só mudam de `TabsContent` para renderização condicional.

### Persistência da seção (opcional, simples)
Guardar `activeTab` em `localStorage` (`admin-tab`) e restaurar na carga, para o admin voltar onde parou. Padrão `"metricas"` se ausente.

## Escopo
- **Único arquivo editado:** `src/pages/AdminPage.tsx`.
  - Remove o bloco `<Tabs>` e o import de `Tabs/TabsContent/TabsList/TabsTrigger`.
  - Adiciona a `<aside>` (desktop) + chip-bar (mobile) e a `<section>` condicional.
  - Ajusta imports de ícones conforme necessário (`Activity`/`LayoutDashboard` para Métricas; demais já importados).
- **Sem mudanças de backend, queries, RLS, rotas ou componentes filhos.**

## Fora de escopo
- Não alterar cores, tema ou estilos dos componentes filhos.
- Não usar o componente shadcn `Sidebar` (evita aninhar `SidebarProvider`/estado global) — sidebar própria leve em Tailwind.
- Não reagrupar em drawer complexo; mobile usa chip-bar rolável.

## Verificação
- Build verde.
- Desktop: sidebar à esquerda fixa no topo ao rolar; clicar em cada item troca o conteúdo; item ativo destacado.
- Mobile 360px: chip-bar horizontal rolável sem estouro; troca de seção funcional; conteúdo legível.
- Fluxos preservados: abrir detalhe de cliente, registrar contato/pagamento, cadastrar candidato no catálogo, exportar clientes — todos seguem funcionando.
