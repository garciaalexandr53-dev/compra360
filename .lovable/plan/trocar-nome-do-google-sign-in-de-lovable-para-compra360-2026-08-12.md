# Trocar nome do Google Sign-In de "Lovable" para "Compra360"

## Problema
Na tela de consentimento do Google, clientes veem **"Prosseguir para Lovable"** em vez de **"Compra360"**. Isso gera desconfiança e confusão durante o cadastro/login.

## Causa confirmada
O projeto usa a credencial **gerenciada pelo Lovable Cloud** para Google OAuth. Quando o provedor é gerenciado, o Google exibe o nome do proprietário da credencial ("Lovable"). Para mostrar o nome próprio do app, é necessário usar um **Google OAuth Client ID próprio** (BYOK), registrado no Google Cloud Console com o nome do app "Compra360".

## Escopo
- **Não alterar** o fluxo de login atual (`src/pages/LoginPage.tsx`, `src/integrations/lovable/index.ts`).
- **Configurar** credencial Google OAuth própria e aplicá-la no Lovable Cloud Auth Settings.
- **Adicionar** texto de tranquilidade no botão de login, se necessário, apenas após a configuração.

## Passos

### 1. Preparar Google Cloud Console
- Criar/identificar um projeto no Google Cloud Console.
- Configurar a **Tela de consentimento OAuth**:
  - Nome do app: **"Compra360"**
  - Email de suporte do usuário: email do administrador.
  - Logotipo: opcional, mas recomendado (marca do Compra360).
  - Dominios autorizados: adicionar os domínios do app:
    - `compra360.lovable.app`
    - `compra360app.com.br`
    - `www.compra360app.com.br`
    - `id-preview--5cec17cd-4654-4102-9c05-28eeee349a5c.lovable.app` (preview)
- Escopos necessários:
  - `.../auth/userinfo.email`
  - `.../auth/userinfo.profile`
  - `openid`

### 2. Criar credenciais OAuth 2.0
- Tipo: **Web application**.
- Nome: "Compra360 Web".
- **Authorized redirect URIs** (exatamente como aparecem no Lovable Cloud Auth Settings):
  - Obter o(s) redirect URI(s) canônicos no painel Lovable Cloud → Users → Auth Settings → Google.
  - Adicionar todos os domínios ativos (public, preview, custom domains).
- Salvar **Client ID** e **Client Secret**.

### 3. Configurar no Lovable Cloud
- Abrir Lovable Cloud → Users → Auth Settings → Sign In Methods → Google.
- Desabilitar/alterar a credencial gerenciada e inserir:
  - Client ID próprio
  - Client Secret próprio
- Salvar.

### 4. Verificar fluxo
- Fazer login via Google no preview/public.
- Confirmar que a tela de consentimento agora exibe **"Prosseguir para Compra360"**.
- Testar callback em todos os domínios ativos.

### 5. (Opcional) Ajuste de copy
- Se ainda houver dúvida dos usuários, adicionar abaixo do botão "Entrar com Google" uma linha:
  - "Seu login é protegido pelo Google." (apenas se necessário).
- Não inserir avisos genéricos que aumentem fricção.

## Critérios de aceite
- [ ] Tela de consentimento do Google mostra "Compra360" (ou "Prosseguir para Compra360").
- [ ] Login com Google continua funcionando em public URL, preview URL e custom domain.
- [ ] Build verde e sem alterações no frontend que quebrem mobile/desktop.

## Nota
Parte do trabalho (Google Cloud Console) precisa ser feita fora do Lovable, pois envolve criação de credencial e domínios verificados no Google. A etapa de inserção da credencial no Lovable Cloud pode ser feita no painel ou, se disponível, via ferramenta de configuração.
