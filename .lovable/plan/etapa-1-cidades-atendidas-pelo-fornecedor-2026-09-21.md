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

**Pede uma única vez.** Depois que ele salva pelo menos uma cidade, o bloco não volta a aparecer sozinho nas cotações seguintes — igual ao CNPJ. Quem já aceitou participar da Rede antes desta etapa e ainda não tem cidade nenhuma vê o bloco uma vez, sozinho, para completar.

**Como ele atualiza depois.** No rodapé de qualquer link de cotação fica a linha discreta: "Atende novas cidades? Atualizar minhas cidades" — mostrada só para quem participa da Rede. Ao tocar, o bloco reabre já com as cidades salvas, ele adiciona ou remove e salva. Sem senha e sem cadastro: o link da cotação já identifica ele com segurança. Você também pode ajustar tudo pelo Painel Admin.

## O que muda para o cliente

As **Sugestões da região** passam a mostrar também fornecedores que declararam atender a cidade da loja, mesmo que nenhum outro supermercado daquela cidade use esse fornecedor ainda. A regra atual (fornecedor já ativo em outra loja da mesma cidade) continua valendo em paralelo, e continua sem sugerir contatos que o cliente já tem na carteira.

## O que muda para você no Painel Admin

Na ficha do fornecedor, uma lista de **Cidades atendidas** com etiquetas, busca por nome e remoção — assim você pode preencher manualmente as cidades dos fornecedores já cadastrados sem depender do representante responder.

## Detalhes técnicos

- Nova tabela `fornecedor_cidades_atendidas` (`fornecedor_id`, `cidade`, `uf`, `cidade_norm`, `created_at`), com RLS, GRANTs para `anon`/`authenticated`/`service_role`, índice em `cidade_norm` e chave única `(fornecedor_id, cidade_norm, uf)`.
- `salvar_dados_fornecedor` ganha o parâmetro `_cidades jsonb` (`[{cidade, uf}]`) e sincroniza a lista de forma atômica (apaga o que saiu, insere o que entrou) na mesma transação.
- `get_supplier_onboarding_state` passa a devolver `pedir_cidades boolean` (true só quando `consentimento_rede = 'sim'`/em aprovação nesta sessão **e** o fornecedor não tem nenhuma linha em `fornecedor_cidades_atendidas`), mais `cidade_loja`/`uf_loja` da loja da cotação para pré-selecionar a etiqueta. Assim o bloco aparece uma única vez por fornecedor.
- `sugerir_fornecedores_por_cidade` recriada: candidatos = consentimento `sim` E (cidade declarada em `fornecedor_cidades_atendidas` OU cidade de alguma loja que ele já atende), mantendo o corte anti-duplicidade por telefone e o dedup pelo cadastro mais recente. GRANT EXECUTE reaplicado junto.
- Novo componente `CidadesAtendidasInput` reutilizando `buscarMunicipios` de `src/lib/cep.ts` (debounce 200ms, mínimo 2 letras), usado no card do link do fornecedor e na ficha do Admin.
- Reabertura pelo representante: `get_supplier_onboarding_state` devolve também `participa_rede` e `cidades` (as já salvas); em `FornecedorCotacaoPage` um link no rodapé (visível quando `participa_rede`) força o card em modo "somente cidades", pré-carregado com as cidades atuais.
- `admin_update_fornecedor` estendida para gravar as cidades enviadas pelo Admin.
- Testes de unidade para a normalização/dedup das cidades; `tsgo` e vitest verdes antes de publicar.
