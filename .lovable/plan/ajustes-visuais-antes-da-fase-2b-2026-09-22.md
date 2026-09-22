# Ajustes visuais antes da Fase 2B

Três correções pontuais de aparência, sem mudar nenhuma funcionalidade.

## 1. Número do WhatsApp quebrando em duas linhas

Na página de cadastro do fornecedor (`/seja-parceiro`), o rodapé "Dúvidas? Fale com a gente no WhatsApp (44) 98448-3553" parte o número no meio, deixando "(44) 98448-" em uma linha e "3553" na outra.

Correção: o número passa a ser tratado como um bloco único que nunca se divide, e a frase "Fale com a gente no WhatsApp" fica em uma linha e o número logo abaixo, inteiro e legível no celular.

## 2. Convite ao fornecedor com mais destaque

Hoje a frase "É fornecedor ou representante? Cadastre-se na Rede Compra360 e seja nosso parceiro" aparece em cinza claro miúdo, quase invisível, tanto no rodapé da página inicial quanto abaixo do login.

Correção: transformar em um convite visível, mantendo a elegância:
- Caixa própria com fundo suave em verde-esmeralda e borda discreta, centralizada.
- Texto em duas partes: a pergunta em cor clara e "Cadastre-se na Rede Compra360 e seja nosso parceiro" em verde-esmeralda com destaque, acompanhado de uma seta.
- Área de toque maior, confortável no celular.
- Mesmo tratamento nas duas telas (página inicial e login), respeitando o tema claro/escuro na tela de login.

## 3. Logo do rodapé quase invisível

No rodapé da página inicial, a logo aparece minúscula acima dos links "Como funciona · Planos · FAQ".

Correção: aumentar a altura da logo no rodapé (de ~28px para ~40px, com largura maior permitida) para que fique nítida no celular, mantendo a proporção e o alinhamento com os demais elementos.

## Detalhes técnicos

- `src/pages/SejaParceiroPage.tsx`: bloco de contato com `whitespace-nowrap` no número e o texto em duas linhas.
- `src/pages/LandingPage.tsx`: `h-7 max-w-[140px]` da logo do rodapé passa a `h-10 max-w-[180px]`; o link `/seja-parceiro` vira um bloco com fundo `bg-emerald-500/10`, borda `border-emerald-500/30`, `rounded-xl`, padding e texto em duas ênfases.
- `src/pages/LoginPage.tsx`: mesmo bloco de convite usando tokens semânticos (`bg-primary/10`, `border-primary/30`, `text-primary`) para funcionar em tema claro e escuro.
- Verificação com `tsgo` e vitest antes de publicar.
