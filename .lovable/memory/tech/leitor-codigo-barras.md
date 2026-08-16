---
name: Leitor de código de barras (html5-qrcode)
description: Regras obrigatórias do BarcodeScannerModal — causa da tela de erro no App Reposição
type: constraint
---

`html5-qrcode` manipula o DOM por conta própria. Regras em `src/components/shared/BarcodeScannerModal.tsx`:

- O nó onde a biblioteca desenha o vídeo é criado imperativamente (`document.createElement`) dentro de um contêiner vazio com `ref`. React nunca deve renderizar filhos ali — se renderizar, a remoção falha com `NotFoundError: removeChild` e cai no ErrorBoundary ("Algo deu errado ao abrir esta tela").
- Nunca chamar `onClose()`/desmontar dentro da callback de leitura da biblioteca. Sempre: `await stop()` + `clear()` primeiro, depois entregar o código e fechar.
- O efeito que inicia a câmera depende SOMENTE de `open` e `attempt`. Callbacks (`onDetected`, `onClose`) vão em `useRef` — em dependências elas reiniciam a câmera a cada digitação do usuário.
- `stop()`/`clear()` sempre com try/catch silencioso.

**Why:** essa combinação causou tela de erro reprodutível no App Reposição ao escanear (ago/2026).
