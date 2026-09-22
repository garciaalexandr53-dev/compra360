---
name: Autocadastro e área do parceiro na Rede
description: Página /seja-parceiro, confirmação reversa por WhatsApp com código de 4 dígitos, área /parceiro sem senha e blueprint da automação via API de WhatsApp
type: feature
---

## Autocadastro (/seja-parceiro)
- Página pública de atração: 100% gratuito, sem senha, sem comissão; diferenciais, 3 passos e depoimentos.
- Duas categorias apenas: **Geral** (sem marcar linhas) e **Especializado** (Bebidas entra aqui).
- Validação estrutural do WhatsApp (`validarWhatsApp` em SejaParceiroPage): DDDs válidos, 9º dígito, sequências falsas.
- RPC `cadastrar_fornecedor_parceiro` (SECURITY DEFINER, anon): anti-duplicidade por `right(fone,10)` (enriquece a ficha existente), `consentimento_rede='sim'`, `origem_cadastro='autocadastro'`, cidades com ON CONFLICT DO NOTHING. Retorna `{status, codigo}`.

## Confirmação reversa por WhatsApp (modo manual atual)
- `gerar_codigo_acesso_parceiro` grava em `fornecedor_acessos` (fornecedor_id, fone_key, codigo 4 dígitos, finalidade `cadastro`/`edicao`, expira em 30 min).
- A tela de sucesso mostra o código e o botão "Confirmar no WhatsApp" abrindo `wa.me/5544984483553` com a mensagem pronta (`src/lib/parceiro.ts`).
- Hoje o admin confere a mensagem no celular e clica **Confirmar WhatsApp** na ficha (`admin_confirmar_parceiro` → `origem_cadastro='autocadastro_confirmado'`, marca o código como confirmado e devolve o token/link do parceiro).
- Filtro e etiqueta "Auto-cadastro" na aba Fornecedores do /admin (`admin_list_fornecedores` retorna `origem_cadastro`, filtro `autocadastro`).

## Área do parceiro sem senha (/parceiro)
- `/parceiro`: digita o WhatsApp → `solicitar_acesso_parceiro` gera código `edicao` → botão abre o WhatsApp do suporte com a mensagem pronta; o admin devolve o link.
- `/parceiro/:token`: `get_parceiro_dados` e `salvar_parceiro_dados` (anon) permitem editar nome, representante, tipo, linhas e cidades. Telefone é somente leitura.

## Blueprint da automação futura (API de WhatsApp)
Quando uma API for conectada (Z-API ou Evolution) ao número do Compra360:
1. Edge Function pública sem JWT recebe o webhook das mensagens.
2. Extrai o código de 4 dígitos e o telefone do remetente.
3. Valida em `fornecedor_acessos` (mesmo fone_key, não expirado, não confirmado) e chama a mesma lógica de `admin_confirmar_parceiro`.
4. Para finalidade `edicao`, responde na conversa com `linkParceiro(token)` (validade curta).
5. A interface do usuário não muda — só deixa de depender da aprovação manual no /admin.

## Convite oficial e prévia no WhatsApp
- Link de divulgação: **https://compra360app.com.br/rede** (`public/rede/index.html`), página estática com as etiquetas Open Graph oficiais ("Rede de Fornecedores Compra360" + `og-rede-fornecedores.jpg` 1200x630) que redireciona para `/seja-parceiro`. Necessária porque o robô do WhatsApp não executa JS num SPA.
- `/rede` está no `navigateFallbackDenylist` do PWA e com `Cache-Control: no-store` em `public/_headers`.
- Mensagem de convite na **voz institucional do Compra360** (nunca a voz do supermercadista): `src/lib/conviteRede.ts` (`montarConviteRede`, `LINK_REDE_PARCEIRO`).
- Painel: botão **Convidar para a Rede** na toolbar da aba Fornecedores abre `ConvidarRedeDialog` (telefone opcional, prévia da mensagem, copiar mensagem, copiar link, abrir no WhatsApp).
