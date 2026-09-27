# Indicadores de desempenho do fornecedor

## Objetivo
Mostrar ao comprador o quanto cada fornecedor costuma responder às cotações, tanto nas sugestões da Rede quanto na lista dos seus próprios fornecedores — sem revelar outras lojas nem valores.

## O que o comprador vai ver

### Janela "Novos fornecedores disponíveis para sua loja" (e o aviso do Painel que a abre)
Uma linha curta abaixo do telefone e das categorias:
- 0 cotações: "Novo na Rede Compra360" (cinza)
- 1 a 2 cotações: "Participou de X cotações na região" (verde suave)
- 3 ou mais, 80% ou mais: "92% de resposta · 14 cotações na região" (verde)
- 3 ou mais, 50% a 79%: amarelo
- 3 ou mais, abaixo de 50%: cinza
- Etiqueta extra "Responde no mesmo dia" quando o tempo médio de retorno for menor que 12h.

Conta todas as cotações do fornecedor no sistema (unindo cadastros da mesma pessoa pelo WhatsApp/CNPJ), mas mostra só números.

### Tela Fornecedores (lista da loja)
Linha discreta no cartão: "Respondeu 8 de 10 cotações da loja" — considera apenas as cotações da loja ativa. Sem histórico, nada aparece.

### Regras
- Resposta válida = enviou preços OU marcou "Sem itens".
- Abrir o link sem responder, ou não abrir, não conta como resposta.
- Tempo de retorno = do envio da cotação até a primeira resposta.
- Nenhum nome de outro supermercado, nenhum valor em R$.
- Liberado para todos os planos.

## Detalhes técnicos
1. Migração:
   - Recriar `sugerir_fornecedores_por_cidade` mantendo toda a lógica atual e adicionando `total_cotacoes`, `total_respondidas`, `tempo_medio_horas`. Agregação por `fornecedor_fone_key` / `fornecedor_cnpj_key` sobre todos os cadastros equivalentes. Convocação = linha em `cotacao_fornecedores` com `enviado_em` preenchido (ou cotação já finalizada); resposta = existe linha em `precos` do fornecedor para produtos daquela cotação (os zeros do "Sem itens" contam). Tempo = `min(precos.updated_at) - enviado_em`.
   - Nova `get_desempenho_fornecedores_loja(_loja_id uuid)` — SECURITY DEFINER, `search_path = public`, exige `auth.uid()` dono da loja; retorna `fornecedor_id, total_cotacoes, total_respondidas, tempo_medio_horas` só das cotações daquela loja. EXECUTE revogado de anon.
2. `src/lib/desempenhoFornecedor.ts` — função pura `classificarDesempenho` (faixas acima) + testes vitest.
3. `src/components/fornecedores/DesempenhoFornecedorBadge.tsx` — linha compacta com ícones Lucide (Sparkles, CheckCircle2, Zap), cores por tokens semânticos.
4. `SugestoesRegiaoDialog.tsx`: tipo `SugestaoFornecedor` ganha os 3 campos e renderiza o badge. `FornecedoresLojaBanner.tsx` já repassa os dados, sem mudança visual.
5. `FornecedoresPage.tsx`: query `["desempenho-fornecedores", lojaAtiva?.id]` e linha no cartão; nenhuma query existente alterada.
6. Verificação: tsgo + vitest verdes e conferência visual em 360px e desktop antes de publicar.
