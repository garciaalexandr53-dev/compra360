import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

/* ── Helpers ─────────────────────────────────────────── */
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

const isFuncionariosApp = window.location.pathname.startsWith("/app-funcionarios");
const FUNCIONARIOS_CACHE_RESET_VERSION = "funcionarios-cache-reset-v1";

/* ── Funcionários: one-time cache clear ──────────────── */
if (
  isFuncionariosApp &&
  localStorage.getItem("funcionarios-cache-reset-version") !== FUNCIONARIOS_CACHE_RESET_VERSION
) {
  localStorage.setItem("funcionarios-cache-reset-version", FUNCIONARIOS_CACHE_RESET_VERSION);

  const clearPwaState = async () => {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    window.location.reload();
  };

  void clearPwaState();
}

/* ── Service Worker update logic (production only) ───── */
if ("serviceWorker" in navigator && !isInIframe && !isPreviewHost) {
  // Force update check on every load
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((reg) => {
      reg.update().catch(() => {});

      // If a waiting SW exists, tell it to activate now
      if (reg.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
        window.location.reload();
      }

      // Listen for new SW becoming installed during this session
      reg.addEventListener("updatefound", () => {
        const newSw = reg.installing;
        if (!newSw) return;
        newSw.addEventListener("statechange", () => {
          if (newSw.state === "installed" && navigator.serviceWorker.controller) {
            // New version ready — activate immediately
            newSw.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });
    });
  });

  // When a new SW takes control, reload once to use fresh assets
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!sessionStorage.getItem("sw-reloaded")) {
      sessionStorage.setItem("sw-reloaded", "1");
      window.location.reload();
    }
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
createRoot(document.getElementById("root")!).render(<App />);
