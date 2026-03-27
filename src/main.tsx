import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Auto-recover from stale chunk errors after deploys
window.addEventListener('error', (e) => {
  const msg = String((e as ErrorEvent).message || '');
  if (
    (msg.includes('Failed to fetch dynamically imported module') ||
     msg.includes('Loading chunk') ||
     msg.includes('Loading CSS chunk')) &&
    !sessionStorage.getItem('lazy-reloaded')
  ) {
    sessionStorage.setItem('lazy-reloaded', '1');
    window.location.reload();
  }
});
window.addEventListener('load', () => sessionStorage.removeItem('lazy-reloaded'));

createRoot(document.getElementById("root")!).render(<App />);
