import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const isFuncionariosApp = window.location.pathname.startsWith("/app-funcionarios");
const FUNCIONARIOS_CACHE_RESET_VERSION = "funcionarios-cache-reset-v1";

if (isFuncionariosApp && localStorage.getItem("funcionarios-cache-reset-version") !== FUNCIONARIOS_CACHE_RESET_VERSION) {
  localStorage.setItem("funcionarios-cache-reset-version", FUNCIONARIOS_CACHE_RESET_VERSION);

  const clearPwaState = async () => {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }

    window.location.reload();
  };

  void clearPwaState();
}

// Force SW update check on every app load — ensures users get the latest version
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((reg) => {
      // Trigger update check
      reg.update().catch(() => {});

      // If a waiting SW exists, activate it immediately
      if (reg.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
        window.location.reload();
      }
    });
  });

  // Listen for new SW becoming available during the session
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!sessionStorage.getItem("sw-reloaded")) {
      sessionStorage.setItem("sw-reloaded", "1");
      window.location.reload();
    }
  });
}

// Auto-recover from stale chunk errors after deploys
const recoverLazyChunk = (msg: string) => {
  if (
    (/Failed to fetch dynamically imported module|Loading chunk|Loading CSS chunk/i.test(msg)) &&
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

createRoot(document.getElementById("root")!).render(<App />);
