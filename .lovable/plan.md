# Etapa 1 — Cidades atendidas pelo fornecedor

Hoje um fornecedor só é sugerido para cidades onde ele já atende alguma loja cadastrada. Por isso um cliente novo em Jussara não recebe nenhuma sugestão, mesmo que os distribuidores de Cianorte atendam Jussara.

A Etapa 1 deixa o próprio representante declarar as cidades que ele atende.

## O que muda para o representante

No link da cotação, quando ele responde **Sim** para participar da Rede, aparece o bloco **Cidades que você atende**:

- Texto de apoio: "Adicione todas as cidades que você atende — quantas quiser. Assim supermercados dessas cidades encontram você."
- A cidade da loja que enviou a cotação já vem sugerida como etiqueta (ex.: `Cianorte - PR ×`).
- Campo de busca por nome: digita `jus`, aparece `Jussara - PR` na lista oficial de municípios, toca e vira etiqueta.
- Pode adicionar quantas cidades quiser e remover qualquer uma no `×`.
- Salvar grava consentimento, CNPJ, linhas de produto e as cidades juntos.

**Pede uma única vez.** Depois que ele salva pelo menos uma cidade, o bloco nunca mais aparece nas cotações seguintes — igual ao CNPJ. Quem já aceitou participar da Rede antes desta etapa e ainda não tem cidade nenhuma vê o bloco uma vez, sozinho, para completar. Alterações posteriores ficam com você no Painel Admin.

## O que muda para o cliente

As **Sugestões da região** passam a mostrar também fornecedores que declararam atender a cidade da loja, mesmo que nenhum outro supermercado daquela cidade use esse fornecedor ainda. A regra atual (fornecedor já ativo em outra loja da mesma cidade) continua valendo em paralelo, e continua sem sugerir contatos que o cliente já tem na carteira.

## O que muda para você no Painel Admin

Na ficha do fornecedor, uma lista de **Cidades atendidas** com etiquetas, busca por nome e remoção — assim você pode preencher manualmente as cidades dos fornecedores já cadastrados sem depender do representante responder.

## Detalhes técnicos

- Nova tabela `fornecedor_cidades_atendidas` (`fornecedor_id`, `cidade`, `uf`, `cidade_norm`, `created_at`), com RLS, GRANTs para `anon`/`authenticated`/`service_role`, índice em `cidade_norm` e chave única `(fornecedor_id, cidade_norm, uf)`.
- `salvar_dados_fornecedor` ganha o parâmetro `_cidades jsonb` (`[{cidade, uf}]`) e sincroniza a lista de forma atômica (apaga o que saiu, insere o que entrou) na mesma transação.
- `get_supplier_onboarding_state` passa a devolver `cidades` (as já salvas) e `cidade_loja`/`uf_loja` da loja da cotação, para pré-selecionar a etiqueta.
- `sugerir_fornecedores_por_cidade` recriada: candidatos = consentimento `sim` E (cidade declarada em `fornecedor_cidades_atendidas` OU cidade de alguma loja que ele já atende), mantendo o corte anti-duplicidade por telefone e o dedup pelo cadastro mais recente. GRANT EXECUTE reaplicado junto.
- Novo componente `CidadesAtendidasInput` reutilizando `buscarMunicipios` de `src/lib/cep.ts` (debounce 200ms, mínimo 2 letras), usado no card do link do fornecedor e na ficha do Admin.
- `admin_update_fornecedor` estendida para gravar as cidades enviadas pelo Admin.
- Testes de unidade para a normalização/dedup das cidades; `tsgo` e vitest verdes antes de publicar.
