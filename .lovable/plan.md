# Destacar os botões "Acessar o painel" e "Confirmar email" nos e-mails

## Problema confirmado

Nos e-mails que chegam aos clientes (confirmar cadastro e notificações), os botões de ação aparecem como **texto puro** no Outlook, sem preenchimento, sem cantos e sem destaque. O usuário recebe o e-mail e não percebe onde clicar.

**Causa (verificada no código):** todos os templates usam o componente `<Button>` do React Email, que gera uma tag `<a>` com `style="background-color:..."`. O Outlook (motor Word) **ignora `background-color` em `<a>` inline**, então o preenchimento verde some e o botão vira texto branco. O fundo escuro da primeira imagem é o Outlook dark-mode invertendo o fundo branco do corpo.

## Solução

Trocar os botões por um **botão bulletproof** baseado em tabela, com o atributo `bgcolor` na célula (o Outlook respeita o atributo HTML `bgcolor`, não o CSS). Assim o botão aparece como um bloco verde preenchido, com padding, clicável, em Outlook e em todos os outros clientes (Gmail, Apple Mail, mobile).

```text
antes:  <Section><Button style={button} href={url}>Confirmar email</Button></Section>
depois: <BulletproofButton href={url}>Confirmar email</BulletproofButton>
```

### 1. Criar componente reutilizável

Arquivo novo: `supabase/functions/_shared/BulletproofButton.tsx`

- Renderiza uma `<table align="center">` com `<td>` usando `bgcolor="#0F766C"` (hex sólido equivalente a `hsl(174, 78%, 26%)`, a cor de marca já usada nos templates).
- Inline style também seta `backgroundColor` + `borderRadius: 8px` (modern clients honram; Outlook ignora o raio, ficando quadrado — aceitável e ainda claramente um botão).
- `<a>` interna com padding `14px 28px`, branco, sem underline, fonte Sora — todo o bloco fica clicável.
- Borda inferior sutil `#0C5F58` para dar leve profundidade.
- Mantém `lang`/`dir` herdados; sem alterar corpo do e-mail.

### 2. Substituir os botões nos templates

Trocar `<Button>` por `<BulletproofButton>` nos templates que têm CTA (verificado um a um):

**Auth (`supabase/functions/_shared/email-templates/`):**
- `signup.tsx` — "Confirmar email"
- `invite.tsx` — "Aceitar convite"
- `magic-link.tsx` — "Entrar no {siteName}"
- `recovery.tsx` — "Redefinir senha"
- `email-change.tsx` — "Confirmar alteração"

> `reauthentication.tsx` não tem botão (exibe código OTP) — sem alteração.

**Transacional (`supabase/functions/_shared/transactional-email-templates/`):**
- `welcome.tsx` — "Acessar o painel"
- `notification.tsx` — rótulo dinâmico (`ctaLabel` / "Ver detalhes")

> `order-confirmation.tsx` não possui botão — sem alteração.

Cada template passa a `import { BulletproofButton } from '../BulletproofButton.tsx'` (path relativo funcionando pois os templates já são importados via caminho relativo pelo hook e pela registry) e remove o `Button` das importações do `@react-email/components`.

### 3. Preservar a saída em texto puro

O `auth-email-hook` gera versão `plainText` via `renderAsync(..., { plainText: true })`. O React Email ignora `<table>`/`<td>` no texto puro e preserva o `<a>` (mesmo comportamento do `<Button>` antigo), então a versão texto continua legível.

### 4. Deploy

Após editar os templates, implantar as funções que os importam:
- `auth-email-hook` (auth)
- `send-transactional-email` (transacional)

### 5. Verificação

- Renderizar HTML de `signup` e `welcome` via preview e confirmar a presença de `<td ... bgcolor="#0F766C">` e do `<a>` preenchido.
- Revisar que `renderAsync` plainText continua gerando texto/URL do link.
- Não há build do Vite para esses arquivos (são Deno); o build do projeto não é afetado. Manter `lovable-exec build` verde e os testes existentes.

## Observações

- Cores de marca mantidas: verde `hsl(174, 78%, 26%)` ≡ `#0F766C` no botão; demais estilos (h1, links, rodapé) inalterados.
- O fundo do corpo permanece `#ffffff` (regra dos e-mails). O efeito dark-mode do Outlook é do cliente e não deve ser combatido trocando o fundo; o objetivo do chamado é garantir que o botão seja **visível/preenchido** — resolvido com o `bgcolor`.
- Não alterar textos, assuntos, layout, logo nem nenhum conteúdo fora do bloco do botão.
