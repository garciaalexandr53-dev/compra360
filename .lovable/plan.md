

# CotaFacil — Sistema de Cotação para Supermercado

Transformar o sistema atual (HTML local) em um app web completo com **Supabase (Lovable Cloud)** como backend, resolvendo sincronização entre dispositivos e recebimento automático de preços.

---

## 1. Backend — Banco de Dados (Supabase)

**Tabelas principais:**
- **produtos** — nome, categoria, embalagem, ativo (na cotação atual ou não)
- **categorias** — 37 categorias (Limpeza, Bebidas, Frios, etc.)
- **fornecedores** — nome, representante, telefone, email, pedido mínimo, observações
- **cotacoes** — cotação ativa e histórico (data de criação, status)
- **cotacao_produtos** — produtos incluídos em cada cotação
- **precos** — preço de cada fornecedor por produto por cotação (preenchido pelo fornecedor via link)
- **pedidos** — pedido gerado por fornecedor, com status de envio

**Autenticação:**
- Login com email/senha para os 2-3 compradores
- Fornecedores acessam por **link único com token** (sem login)

---

## 2. Páginas do Comprador (com login)

### Cotação de Preços
- Tabela interativa produtos × fornecedores com preços editáveis
- Destaque automático: menor preço (verde), segundo menor (amarelo)
- Filtro por fornecedor e busca por produto
- Preços dos fornecedores aparecem **em tempo real** (Supabase realtime)
- Botão "Nova Cotação" salva a atual no histórico e cria uma nova

### Pedidos por Fornecedor
- Lista agrupada por fornecedor com totais
- Alerta de pedido mínimo não atingido com botão "Redistribuir"
- Envio do pedido: formatação para **WhatsApp** (abre link direto) e **geração de PDF**

### Banco de Produtos
- Sidebar com categorias e contagem
- Busca global, adicionar/editar/remover produtos
- Botão para incluir/remover produto da cotação ativa

### Gestão de Fornecedores
- CRUD completo com todos os campos
- Gerar/copiar link único para cada fornecedor

### Histórico
- Lista de cotações anteriores, visualizar detalhes, restaurar

---

## 3. Página do Fornecedor (sem login, via link único)

- Página mobile-friendly acessada pelo link compartilhado via WhatsApp
- Lista dos produtos da cotação ativa com campo de preço para cada um
- Botão "Enviar Preços" → salva direto no banco
- Os preços aparecem automaticamente na tela do comprador (tempo real)
- Interface simples e clara para pessoas não técnicas

---

## 4. Design e UX

- Interface em **Português Brasileiro**
- Design limpo com sidebar de navegação (abas)
- **Mobile-first** — funciona perfeitamente no Android Chrome
- Fonte moderna, valores numéricos com formatação brasileira (R$ 1.234,56)
- Tema claro com destaques de cor para preços (verde/amarelo/vermelho)

---

## 5. Importação dos Dados

Após receber o arquivo HTML original, os 2.210 produtos, 37 categorias e 14 fornecedores serão importados para o banco de dados.

