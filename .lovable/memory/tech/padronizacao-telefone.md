---
name: Padronização de telefone
description: Celulares salvos com 11 dígitos via normalizeTelefone; sugestões e cópia de fornecedores deduplicam por fone_key/CNPJ
type: feature
---

## Regra
- Telefone de fornecedor é sempre gravado padronizado: `normalizeTelefone` em `src/lib/masks.ts` acrescenta o nono dígito quando o celular vem com 10 dígitos (3º dígito entre 6 e 9), remove prefixo 55 e formata `(44) 99977-6453`.
- Aplicado em `FornecedoresPage.handleSave` e em `CadastroParceiroPage` (autocadastro `/seja-parceiro`).
- Higienização retroativa já executada: 5 registros com 10 dígitos corrigidos (SOMAVE x2, SARTORI, ARILU, MUFFATAO).

## Deduplicação no banco
- `sugerir_fornecedores_por_cidade`: chave de grupo `COALESCE('f:'||fornecedor_fone_key, 'c:'||fornecedor_cnpj_key, 'n:'||nome_norm||'|'||rep_norm)`; exibe o cadastro mais completo (CNPJ > 11 dígitos de telefone > prazo > pedido mínimo > pasta > mais recente); exclui o que o usuário já tem pela mesma chave.
- `copiar_fornecedores_para_loja`: copia também `cnpj` e `consentimento_rede`, deduplica o lote pela mesma chave e nunca insere fornecedor que o usuário já possui.
