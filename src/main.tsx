import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register the push service worker (production only – avoids Vite dev interference).
// Resolved against the document, not "/": the site is served from a subpath on
// GitHub Pages, where an absolute "/sw.js" points outside the app entirely.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(new URL("sw.js", document.baseURI).toString(), {
        scope: new URL("./", document.baseURI).toString(),
      })
      .catch((err) => {
        console.warn("[sw] register failed", err);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
