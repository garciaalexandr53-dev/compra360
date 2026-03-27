import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Auto-recover from stale chunk errors after deploys
const recoverLazyChunk = (msg: string) => {
  if (
    (/Failed to fetch dynamically imported module|Loading chunk|Loading CSS chunk/i.test(msg)) &&
    !sessionStorage.getItem('lazy-reloaded')
  ) {
    sessionStorage.setItem('lazy-reloaded', '1');
    location.reload();
  }
};
window.addEventListener('error', (e) => recoverLazyChunk((e as ErrorEvent).message || ''));
window.addEventListener('unhandledrejection', (e) => recoverLazyChunk(String((e as PromiseRejectionEvent).reason?.message || (e as PromiseRejectionEvent).reason || '')));
window.addEventListener('load', () => sessionStorage.removeItem('lazy-reloaded'));

createRoot(document.getElementById("root")!).render(<App />);
