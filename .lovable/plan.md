# Consentimento e coleta de dados no link do fornecedor

## Objetivo
No link público de cotação, o representante passa a informar o CNPJ da empresa que representa, suas linhas de produtos (quando necessário) e se aceita participar da Rede — a lista em que o contato dele pode aparecer para supermercados da região. Só quem aceita entra nas sugestões de outros clientes.

## O que o representante vê

### Cartão no topo da cotação
- Aparece antes dos produtos, sem bloquear o preenchimento dos preços.
- **CNPJ** (quando ainda não temos): campo com máscara `00.000.000/0000-00` e botão "Responder depois" ao lado.
- **Linhas de produtos**: aparece somente quando o CNPJ digitado já existe em outro cadastro (mesma empresa, representante diferente). Seleção múltipla das tags: Frios e Laticínios, Carnes, Hortifruti, Padaria, Limpeza, Higiene e Beleza, Mercearia, Congelados, Pet — e "Bebidas" apenas para quem está classificado como Especializado, já que quem é do tipo Bebidas já está identificado por esse campo.
- **Rede**: pergunta sempre exibida (mesmo para quem pulou o CNPJ), com o texto aprovado: "Estamos pensando em uma função onde seu contato pode aparecer para outros supermercados da sua região que ainda não compram de você, para gerar novos negócios. Isso significa que esses novos clientes também vão ver há quanto tempo você está cadastrado e sua taxa de resposta às cotações. Você toparia participar dessa lista?" — opções **Sim**, **Não**, **Preciso pensar**.
- Ao salvar, o cartão some e mostra uma confirmação curta ("Obrigado! Dados atualizados.").

### Quando parar de perguntar
- "Sim" → registra a participação e nunca pergunta de novo.
- "Não" ou "Preciso pensar" → só volta a perguntar depois de 90 dias.
- Se recusar uma segunda vez → espera 180 dias e depois não pergunta mais.

### Responder depois (pular)
- Cada vez que ele pula o CNPJ **e conclui a cotação enviando preços**, conta uma tentativa. Pular sem enviar preço não conta.
- Na 3ª tentativa em diante o botão "Responder depois" desaparece e entra o texto: "Para continuar recebendo cotações, complete o cadastro da sua empresa." O envio de preços continua liberado.
- Informar o CNPJ zera a contagem.

## Detalhes técnicos

1. **Migração** em `public.fornecedores`: `cnpj text`, `consentimento_rede text not null default 'pendente' check (in ('pendente','sim','nao'))`, `consentimento_ultima_pergunta timestamptz`, `consentimento_tentativas_skip int not null default 0`, mais `consentimento_recusas int not null default 0` (necessário para distinguir a 1ª recusa, com 90 dias, da 2ª, com 180 dias e fim das perguntas). Índice em `cnpj` (dígitos) para a checagem de duplicidade. `pasta text[]` é reaproveitada.
2. **RPCs `security definer`, `set search_path = public`, `execute` para `anon` + `authenticated`** (o portal do fornecedor é anônimo, autenticado por token):
   - `get_supplier_onboarding_state(_token text)` → `pedir_cnpj bool`, `pedir_pasta bool`, `pedir_consentimento bool`, `permite_skip bool`, `pasta text[]`. `pedir_consentimento` aplica a janela: `pendente` → sim; `nao` com `consentimento_recusas = 1` → só após 90 dias; `recusas >= 2` → nunca. `permite_skip` = `consentimento_tentativas_skip < 3`.
   - `checar_cnpj_duplicado(_token text, _cnpj text)` → bool, comparando só dígitos, ignorando o próprio registro.
   - `salvar_dados_fornecedor(_token text, _cnpj text, _pasta text[], _consentimento text)` → grava o que veio: CNPJ (dígitos, valida 14) zerando `consentimento_tentativas_skip`; `pasta` quando enviada; consentimento `'sim'`/`'nao'` sempre com `consentimento_ultima_pergunta = now()` e `consentimento_recusas = consentimento_recusas + 1` nas recusas.
   - `registrar_skip_cnpj(_token text)` → incrementa `consentimento_tentativas_skip` apenas quando `cnpj is null`.
3. **`sugerir_fornecedores_por_cidade`**: recriada com `and f.consentimento_rede = 'sim'` no `WHERE`, mantendo o resto da lógica atual (cidade normalizada, dedupe por telefone, exclusão da própria carteira).
4. **Front**: novo `src/components/fornecedor/OnboardingFornecedorCard.tsx` (estado do cartão, máscara de CNPJ via `src/lib/masks.ts`, tags de pasta, botões de consentimento) usado em `src/pages/FornecedorCotacaoPage.tsx` na tela `ready`, alimentado por `get_supplier_onboarding_state`. O estado de "pulou nesta sessão" fica no componente e é informado ao enviar.
5. **`supabase/functions/submit-precos/index.ts`**: aceita `skip_cnpj_pendente: boolean` no corpo e, após o upsert bem-sucedido com pelo menos um preço, chama `registrar_skip_cnpj` — assim a tentativa só conta quando a cotação foi realmente concluída.
6. **Pastas**: `PASTAS_FORNECEDOR` em `src/lib/adminHelpers.ts` continua sem "Bebidas"; uma função nova `pastasDisponiveis(tipo)` devolve a lista com "Bebidas" só quando `tipo_fornecedor = 'especializado'`, usada tanto pela ficha do Admin quanto pelo cartão público — nenhum valor duplicado entre os dois campos.
7. **Painel**: a ficha do Admin passa a exibir CNPJ e o status do consentimento (somente leitura nesta etapa).
7. Verificação: `tsgo`, `vitest` (testes novos para a janela de 90/180 dias e para o limite de 3 skips) e revisão no portal do fornecedor em 360px e desktop.
