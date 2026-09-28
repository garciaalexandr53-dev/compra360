# Consulta automática de CNPJ oficial (Receita Federal)

## Objetivo
Em toda tela que pede CNPJ, ao completar os 14 dígitos o sistema valida e consulta a Receita (BrasilAPI) e preenche sozinho Razão Social, Nome Fantasia e Cidade/UF oficiais. A pessoa só completa o que é dela (pastas, cidades atendidas, pedido mínimo, prazo).

## Comportamento
1. Validação dos dígitos verificadores: CNPJ digitado errado mostra "CNPJ inválido" na hora, sem consultar.
2. Consulta em ~1 segundo com indicador "Consultando Receita...".
3. Resultado:
   - Ativo: mostra cartão verde "Razão Social · Cidade/UF · Situação: Ativa" e preenche os campos.
   - Baixado/Inapto/Suspenso: aviso âmbar "CNPJ com situação X na Receita" e bloqueia salvar (exceto Admin, que pode prosseguir).
   - Não encontrado ou serviço fora do ar: aviso discreto "Não foi possível consultar agora" e a pessoa preenche manualmente (nunca trava o cadastro).
4. Campos preenchidos pela Receita ficam editáveis nas telas internas (loja, perfil, admin); no link do fornecedor e no /seja-parceiro o nome oficial é gravado automaticamente.

## Telas
1. Link da cotação do fornecedor (card "Complete o cadastro"): grava Razão Social/Nome Fantasia oficiais junto com o CNPJ.
2. Autocadastro na Rede (/seja-parceiro e cadastro do parceiro).
3. Cadastro de fornecedor pelo comprador (tela Fornecedores).
4. Ficha do fornecedor no Painel Admin.
5. Cadastro/edição de Loja e Perfil (preenche também CEP, endereço, número, bairro, cidade, UF se vazios).
6. Onboarding inicial do supermercado.

## O que não muda
Checagem de CNPJ duplicado, regras da Rede, consentimento, cidades atendidas e todas as gravações existentes.

## Detalhes técnicos
- Novo `src/lib/cnpj.ts`: `validarCNPJ` (módulo 11), `consultarCNPJ(digitos)` via `https://brasilapi.com.br/api/cnpj/v1/{cnpj}` com timeout 8s e cache em memória; normaliza para `{ razao_social, nome_fantasia, situacao, cep, logradouro, numero, bairro, municipio, uf }`. Testes em `src/lib/cnpj.test.ts`.
- Hook `useConsultaCNPJ(cnpj)` com debounce 500ms e componente `CnpjStatus` (cartão de resultado) reutilizado nas 6 telas.
- Nomes gravados com `formatNomeEmpresa`; cidade no padrão das cidades já usado.
- `salvar_dados_fornecedor`: nova migração adicionando parâmetros opcionais `_razao_social` e `_nome_fantasia` (default null, preenchem só se vierem) — assinatura antiga preservada via default.
- Sem nova chave/segredo (API pública). Build verde (tsgo + vitest) antes de publicar.
