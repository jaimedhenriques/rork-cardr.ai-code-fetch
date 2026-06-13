import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { configureStatusBar, hideSplash, isNative } from "./lib/native";

if (isNative()) {
  // Fire and forget — don't block React mount.
  configureStatusBar();
  // Give the first paint a moment, then dismiss the splash.
  setTimeout(() => { hideSplash(); }, 600);
}

// Register the service worker so the web app is installable as a desktop/mobile
// PWA (Chrome shows "Install") and launches instantly. Skipped in native shells.
if ("serviceWorker" in navigator && !isNative() && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed:", err);
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
