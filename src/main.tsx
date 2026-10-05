import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";


/* ── Helpers ─────────────────────────────────────────── */
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

// Páginas abertas por pessoas de fora (fornecedor, parceiro, funcionário) via link.
// Nunca devem ficar presas em versão antiga do cache do navegador.
const PUBLIC_LINK_PREFIXES = ["/fornecedor", "/parceiro", "/seja-parceiro", "/reposicao", "/app-funcionarios", "/unsubscribe"];
const isPublicLinkPage = PUBLIC_LINK_PREFIXES.some((p) => window.location.pathname.startsWith(p));
// Aumente esta versão para forçar nova limpeza em todos os aparelhos.
const PUBLIC_CACHE_RESET_VERSION = "public-cache-reset-v2";
const PUBLIC_CACHE_RESET_KEY = "public-cache-reset-version";

/* ── Páginas públicas: limpeza única de cache antigo ─── */
if (isPublicLinkPage && !isInIframe && !isPreviewHost) {
  let storedVersion: string | null = null;
  try { storedVersion = localStorage.getItem(PUBLIC_CACHE_RESET_KEY); } catch { /* ignore */ }
  const hadController = "serviceWorker" in navigator && !!navigator.serviceWorker.controller;
  if (storedVersion !== PUBLIC_CACHE_RESET_VERSION) {
    try { localStorage.setItem(PUBLIC_CACHE_RESET_KEY, PUBLIC_CACHE_RESET_VERSION); } catch { /* ignore */ }
    const clearPwaState = async () => {
      try {
        if ("serviceWorker" in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((r) => r.unregister()));
        }
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(
            keys.filter((k) => /workbox|precache|runtime/i.test(k)).map((k) => caches.delete(k)),
          );
        }
      } finally {
        // Só recarrega se a página atual veio do cache antigo
        if (hadController && !sessionStorage.getItem("public-cache-reloaded")) {
          sessionStorage.setItem("public-cache-reloaded", "1");
          window.location.reload();
        }
      }
    };
    void clearPwaState();
  }
}

/* ── Service Worker update logic (production only) ───── */
const UPDATE_CHECK_INTERVAL_MS = 60 * 1000; // poll every minute while tab is open
let isReloadingForUpdate: boolean = false;

const reloadForUpdate = () => {
  if (isReloadingForUpdate) return;
  isReloadingForUpdate = true;
  const doReload = () => location.reload();
  // Clear any caches before reloading to guarantee fresh assets
  if (typeof caches !== "undefined") {
    caches.keys().then((keys) => {
      Promise.all(keys.map((k) => caches.delete(k))).finally(doReload);
    }).catch(doReload);
  } else {
    doReload();
  }
};

const activateWaiting = (reg: ServiceWorkerRegistration) => {
  if (reg.waiting) {
    reg.waiting.postMessage({ type: "SKIP_WAITING" });
  }
};

const trackInstalling = (reg: ServiceWorkerRegistration, sw: ServiceWorker | null) => {
  if (!sw) return;
  sw.addEventListener("statechange", () => {
    if (sw.state === "installed" && navigator.serviceWorker.controller) {
      // A new version is ready — activate immediately
      sw.postMessage({ type: "SKIP_WAITING" });
    }
  });
};

if ("serviceWorker" in navigator && !isInIframe && !isPreviewHost) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((reg) => {
      // Check for update right now
      reg.update().catch(() => {});

      // If something is already waiting from a previous load, activate it
      if (reg.waiting && navigator.serviceWorker.controller) {
        activateWaiting(reg);
      }

      // Track future installations (during this tab's lifetime)
      reg.addEventListener("updatefound", () => trackInstalling(reg, reg.installing));

      // Periodic background check while the tab stays open
      setInterval(() => {
        reg.update().catch(() => {});
      }, UPDATE_CHECK_INTERVAL_MS);
    });
  });

  // Re-check when the tab regains focus or comes back online
  const recheck = () => {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.update().catch(() => {}));
    });
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") recheck();
  });
  window.addEventListener("online", recheck);
  window.addEventListener("focus", recheck);

  // When a new SW takes control, reload to load fresh assets
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    reloadForUpdate();
  });
} else if ("serviceWorker" in navigator && (isInIframe || isPreviewHost)) {
  // In preview/iframe: unregister any stale SWs
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister());
  });
}

/* ── Auto-recover stale chunk errors after deploys ───── */
const recoverLazyChunk = (msg: string) => {
  if (
    /Failed to fetch dynamically imported module|Loading chunk|Loading CSS chunk/i.test(msg) &&
    !sessionStorage.getItem("lazy-reloaded")
  ) {
    sessionStorage.setItem("lazy-reloaded", "1");
    location.reload();
  }
};
window.addEventListener("error", (e) => recoverLazyChunk((e as ErrorEvent).message || ""));
window.addEventListener("unhandledrejection", (e) =>
  recoverLazyChunk(String((e as PromiseRejectionEvent).reason?.message || (e as PromiseRejectionEvent).reason || ""))
);
window.addEventListener("load", () => {
  sessionStorage.removeItem("lazy-reloaded");
  sessionStorage.removeItem("sw-reloaded");
});

/* ── Mount ───────────────────────────────────────────── */
createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);

