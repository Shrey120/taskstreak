import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register push service worker (production only – avoids Vite dev interference).
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
      console.warn("[sw] register failed", err);
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
