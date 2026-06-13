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

createRoot(document.getElementById("root")!).render(<App />);
