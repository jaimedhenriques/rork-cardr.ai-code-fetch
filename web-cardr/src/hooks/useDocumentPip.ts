import { useCallback, useEffect, useRef, useState } from "react";

interface DocumentPictureInPictureApi {
  requestWindow(options?: {
    width?: number;
    height?: number;
    disallowReturnToOpener?: boolean;
  }): Promise<Window>;
  window: Window | null;
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPictureApi;
  }
}

/**
 * Document Picture-in-Picture helper (Chrome/Edge desktop 116+).
 *
 * Opens a small always-on-top window and copies the app's stylesheets into it
 * so Tailwind classes and CSS variables render identically. Used by the
 * floating meeting recorder so it can sit over Zoom/Meet/Teams during a call.
 */
export function useDocumentPip() {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const pipRef = useRef<Window | null>(null);

  const isSupported =
    typeof window !== "undefined" && "documentPictureInPicture" in window;

  const close = useCallback(() => {
    try {
      pipRef.current?.close();
    } catch {
      // Window already gone
    }
    pipRef.current = null;
    setPipWindow(null);
  }, []);

  const open = useCallback(async (width = 340, height = 440): Promise<Window | null> => {
    if (!window.documentPictureInPicture) return null;
    try {
      const pip = await window.documentPictureInPicture.requestWindow({ width, height });

      // Copy every stylesheet so the PiP window looks exactly like the app.
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          const css = Array.from(sheet.cssRules).map((r) => r.cssText).join("\n");
          const style = pip.document.createElement("style");
          style.textContent = css;
          pip.document.head.appendChild(style);
        } catch {
          // Cross-origin stylesheet — link it instead of inlining.
          if (sheet.href) {
            const link = pip.document.createElement("link");
            link.rel = "stylesheet";
            link.href = sheet.href;
            pip.document.head.appendChild(link);
          }
        }
      }

      // Carry over theme classes (dark mode etc.) and reset default margins.
      pip.document.documentElement.className = document.documentElement.className;
      pip.document.body.className = document.body.className;
      pip.document.body.style.margin = "0";
      pip.document.title = "cardr — recording";

      pip.addEventListener("pagehide", () => {
        pipRef.current = null;
        setPipWindow(null);
      });

      pipRef.current = pip;
      setPipWindow(pip);
      return pip;
    } catch (err) {
      console.error("Document PiP failed to open:", err);
      return null;
    }
  }, []);

  // Close the floating window if the owning component unmounts.
  useEffect(() => close, [close]);

  return { isSupported, pipWindow, open, close };
}
