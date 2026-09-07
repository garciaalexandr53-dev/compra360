# Plano: "Começar grátis" vai direto para o cadastro

## Objetivo
Hoje todos os botões da LandingPage chamam o mesmo `goLogin()` que abre `/login` no modo "entrar". O usuário precisa clicar em "Não tem conta? Cadastre-se" para acessar o cadastro.

Queremos que os CTAs de criação de conta abram **direto no formulário de cadastro**, enquanto "Entrar" continua abrindo o login.

## Mudanças

### 1) `src/pages/LoginPage.tsx` — ler o modo do cadastro pela URL
- Inicializar `isSignUp` a partir de um query param, ex. `?cadastro=1`:
  ```ts
  const [isSignUp, setIsSignUp] = useState(
    searchParams.get("cadastro") === "1"
  );
  ```
- Sem alterar o `next`, o fluxo do Google OAuth, a validação de WhatsApp, o redirect pós-login ou qualquer outra lógica.
- O botão de alternância "Já tem conta? / Não tem conta?" continua funcionando normalmente para trocar entre os modos.

### 2) `src/pages/LandingPage.tsx` — separar os destinos
- Manter `goLogin()` apontando para `/login` (modo entrar).
- Adicionar `goSignup()` que navega para `/login?cadastro=1`:
  ```ts
  const goSignup = () => navigate("/login?cadastro=1");
  ```
- Aplicar `goSignup` aos CTAs de criação de conta e manter `goLogin` nos de entrada:
  - Nav "Entrar" → `goLogin`
  - Nav "Começar grátis" → `goSignup`
  - Hero "Começar grátis agora" → `goSignup`
  - Botões dos planos ("Começar grátis", "Quero ganhar tempo", "Começar 30 dias grátis") → `goSignup`
  - CTA final "Começar a economizar agora" → `goSignup`
  - Footer "Entrar" → `goLogin`

### 3) Observação sobre o visual do "Entrar"
O botão "Entrar" é intencionalmente discreto (variant ghost) para o destaque ficar em "Começar grátis". Essa hierarquia visual será mantida; não haverá mudança de estilo neste ajuste.

## Fora de escopo
- Nenhuma alteração em autenticação, backend, RLS ou Edge Functions.
- Nenhuma alteração de estilo além do destino dos cliques.
- Google sign-in e fluxo pós-login seguem idênticos.

## Validação
- Typecheck (`tsgo`) verde.
- Verificação por navegador: clicar em "Começar grátis" abre `/login?cadastro=1` já no modo cadastro (com campo de WhatsApp visível); clicar em "Entrar" abre no modo login. Em desktop e 360px.
