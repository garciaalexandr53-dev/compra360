# Reorganização das abas do Painel Administrativo

## Problema
O `AdminPage.tsx` usa uma única `TabsList` com **9 abas lado a lado** (`grid-cols-9` no desktop, `grid-cols-3` no mobile). Isso polui a tela e mistura, no mesmo nível, áreas de natureza diferente (visão geral, clientes, financeiro, comunicação e produtos). Hoje as abas são:

```
Métricas · Alertas · Clientes · Pagamentos · Contatos · E-mails · Catálogo · Candidatos · Histórico
```

## Solução proposta

Agrupar **Catálogo · Candidatos · Histórico** em uma única aba **"Produtos"**, com sub-navegação interna (segmented control) para alternar entre os três. Assim a barra principal cai de 9 para 7 abas e ganha um agrupamento lógico.

### Barra principal nova (7 abas)
```
Métricas · Alertas · Clientes · Pagamentos · Contatos · E-mails · Produtos
```

Layout: `grid-cols-3` no mobile e `grid-cols-7` (ou `flex-wrap`) no desktop, mantendo ícones apenas onde já existem e padronizando o ícone de "Produtos" com `Package`.

### Aba "Produtos" — sub-navegação interna
Dentro de `TabsContent value="produtos"`, um **segmented control** local (estado `subProdutos`, padrão `"catalogo"`) com 3 opções:

- **Catálogo** (`Package`) → `<CatalogoTab />`
- **Candidatos** (`PackagePlus`) → `<CandidatosTab />`
- **Histórico** (`History`) → `<HistoricoCatalogoTab />`

O segmented control usa o componente já existente (`Tabs`/`TabsList` aninhado ou um grupo de `Button` `variant="ghost"`) e fica grudado no topo do conteúdo, sticky, para o admin sempre saber em qual sub-área está. As contagens/badges específicas de candidatos (se houver) migram para o respectivo item do sub-nav.

### Estado e comportamento
- Adicionar `const [subProdutos, setSubProdutos] = useState<"catalogo" | "candidatos" | "historico">("catalogo")`.
- Ao clicar na aba "Produtos", manter o último sub-item visitado (não resetar para Catálogo toda vez) — valor persiste no estado do componente.
- Manter inalteradas as queries, mutations e os componentes filhos (`CatalogoTab`, `CandidatosTab`, `HistoricoCatalogoTab`). Apenas movemos onde são renderizados.
- Os `TabsContent` antigos de `catalogo`/`candidatos`/`historico` saem da `TabsList` externa; passam a ser selecionados pelo `subProdutos` dentro do `TabsContent value="produtos"`.

## Escopo (o que muda)
- **Único arquivo editado:** `src/pages/AdminPage.tsx`.
  - `TabsList`: remove os 3 `TabsTrigger` de Catálogo/Candidatos/Histórico, ajusta grid para 7 colunas.
  - Adiciona 1 `TabsTrigger value="produtos"`.
  - Substitui os 3 `TabsContent` por 1 `TabsContent value="produtos"` contendo o sub-nav + renderização condicional.
- **Sem mudança de backend, queries, RLS ou componentes filhos.**

## Fora de escopo
- Não reagrupar Métricas/Alertas/Clientes/etc. (apenas os 3 de produtos, conforme pedido).
- Não alterar cores, tema, ou estilos dos componentes filhos.
- Não mexer em rotas nem permissões.

## Verificação
- Build verde.
- Mobile 360px: barra de 7 abas em `grid-cols-3` sem estouro; sub-nav legível.
- Desktop: 7 abas inline; ao abrir "Produtos", alternar entre Catálogo/Candidatos/Histórico funciona sem recarregar queries desnecessariamente.
- Fluxo de "Cadastrar candidato" → abre o `CatalogoItemSheet` normalmente; ao salvar, invalida queries como hoje.
