# Editar Cidade e UF das lojas pelo Painel Admin

## Objetivo
Permitir que você (admin) preencha Cidade e UF das lojas diretamente no painel `/admin`, sem depender do cliente — principalmente as ~20 lojas antigas que estão em branco. Edição livre, sem obrigatoriedade.

## O que muda para você

- Na ficha do cliente (o painel lateral que abre ao clicar em um cliente na aba Clientes), aparece uma nova seção **Lojas** listando todas as lojas daquele cliente.
- Cada loja mostra: nome, cidade e UF atuais — com campos editáveis de **Cidade** (texto) e **UF** (2 letras, maiúsculas) e um botão **Salvar** por loja.
- O botão Salvar só fica ativo quando algo mudou; ao salvar, aparece confirmação e a lista é atualizada.
- Funciona para loja sem cidade (campos vazios prontos para preencher) e para corrigir cidade/UF já preenchidas.
- Cada edição fica registrada no histórico de contatos do cliente (mesmo padrão da edição de fornecedores): "Loja atualizada pelo suporte: X | cidade: — → Cianorte | uf: — → PR".

## Detalhes técnicos

1. **Migração — RPC `admin_update_loja(_loja_id uuid, _cidade text, _uf text)`** seguindo o padrão exato de `admin_update_fornecedor`:
   - `SECURITY DEFINER`, `SET search_path = public`, guarda `is_admin()` com exceção 'Access denied: admin only'.
   - Cidade: `NULLIF(btrim(...))` (vazio vira NULL); UF: 2 letras maiúsculas via `upper(btrim(...))`, rejeita tamanho > 2 com exceção.
   - Registra antes/depois em `admin_contatos` (canal 'email', motivo 'manual', admin_id = auth.uid()) quando cidade ou UF mudarem, vinculado ao `user_id` dono da loja.
   - `REVOKE EXECUTE ... FROM PUBLIC, anon; GRANT EXECUTE ... TO authenticated` (mesmo padrão das RPCs admin existentes).

2. **`admin_get_cliente_detalhes` ampliada**: incluir no retorno um array `lojas` com `id`, `nome`, `nome_fantasia`, `cidade`, `uf` de todas as lojas do cliente (hoje o admin não consegue ler `lojas` de outros usuários por causa das regras de acesso — a RPC resolve isso no mesmo padrão security definer já usado). Nenhum campo existente é removido ou renomeado.

3. **`src/components/admin/ClienteDetalhesSheet.tsx`**:
   - Nova seção "Lojas" entre "Uso da Plataforma" e "Histórico de contatos".
   - Cada loja vira um card com nome, inputs de Cidade e UF (mesma estrutura visual da ficha: `border`, `bg-card/50`, UF com `uppercase` e maxLength 2) e botão Salvar desabilitado até haver mudança.
   - Mutation chama `admin_update_loja`, invalida `admin-cliente-detalhes`, toast de sucesso/erro.
   - Nenhuma alteração nas seções existentes nem nas RPCs/consultas que já funcionam.

4. **Verificação**: tsgo, testes existentes, conferência visual em desktop e 360px; teste funcional real preenchendo cidade/UF de uma loja antiga via painel.

## Fora de escopo
- Nenhuma obrigatoriedade ou trava de validação além do formato da UF.
- Nada muda no sistema do cliente (o aviso "Sem cidade" que já existe continua e some sozinho quando você preencher).
