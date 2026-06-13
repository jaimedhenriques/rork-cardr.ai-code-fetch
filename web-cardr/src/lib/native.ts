// Thin wrapper around Capacitor plugins so the web build degrades gracefully.
import { Capacitor } from "@capacitor/core";

export const isNative = () => Capacitor.isNativePlatform();
export const platform = () => Capacitor.getPlatform(); // 'ios' | 'android' | 'web'

// ---------- Camera ----------
export async function takePhoto(): Promise<string | null> {
  if (!isNative()) return null;
  const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
  const photo = await Camera.getPhoto({
    quality: 85,
    allowEditing: false,
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Camera,
    saveToGallery: false,
  });
  return photo.dataUrl ?? null;
}

export async function pickFromGallery(): Promise<string | null> {
  if (!isNative()) return null;
  const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
  const photo = await Camera.getPhoto({
    quality: 85,
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Photos,
  });
  return photo.dataUrl ?? null;
}

// ---------- Haptics ----------
export async function tap() {
  if (!isNative()) return;
  const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
  try { await Haptics.impact({ style: ImpactStyle.Light }); } catch {}
}

export async function success() {
  if (!isNative()) return;
  const { Haptics, NotificationType } = await import("@capacitor/haptics");
  try { await Haptics.notification({ type: NotificationType.Success }); } catch {}
}

// ---------- Share ----------
export async function shareNative(opts: { title?: string; text?: string; url?: string }) {
  if (!isNative()) {
    if (navigator.share) return navigator.share(opts);
    return;
  }
  const { Share } = await import("@capacitor/share");
  await Share.share({ ...opts, dialogTitle: opts.title });
}

/**
 * Share a file via the native OS share sheet (iOS/Android) so users can save to
 * Files, AirDrop, Mail, WhatsApp, etc. Falls back to:
 *   1. Web Share API with `files` (modern mobile browsers)
 *   2. Plain `<a download>` (desktop / unsupported browsers)
 *
 * Returns the channel that handled the share so callers can show appropriate UX.
 */
export async function shareFile(opts: {
  filename: string;
  mimeType: string;
  data: Blob | string; // string is treated as text content
  title?: string;
  text?: string;
}): Promise<"native" | "webshare" | "download"> {
  const { filename, mimeType, title, text } = opts;
  const blob =
    typeof opts.data === "string"
      ? new Blob(["\uFEFF" + opts.data], { type: `${mimeType};charset=utf-8;` })
      : opts.data;

  // 1) Native (iOS/Android) — write to cache, then open share sheet with file URL.
  if (isNative()) {
    try {
      const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
      const { Share } = await import("@capacitor/share");
      // Convert blob → base64 (strip the data URL prefix).
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error);
        reader.onload = () => {
          const result = String(reader.result || "");
          const idx = result.indexOf(",");
          resolve(idx >= 0 ? result.slice(idx + 1) : result);
        };
        reader.readAsDataURL(blob);
      });
      const written = await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Cache,
        // base64 string write — Encoding omitted on purpose
        recursive: true,
      });
      await Share.share({
        title: title ?? filename,
        text,
        url: written.uri,
        dialogTitle: title ?? "Share file",
      });
      // Silence unused-import warning when Encoding isn't used.
      void Encoding;
      return "native";
    } catch (err) {
      console.warn("[shareFile] native path failed, falling back", err);
    }
  }

  // 2) Web Share API with files (Android Chrome, iOS Safari PWA, etc.).
  try {
    const file = new File([blob], filename, { type: mimeType });
    const nav = navigator as Navigator & {
      canShare?: (data: { files?: File[] }) => boolean;
    };
    if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
      await nav.share({ files: [file], title, text });
      return "webshare";
    }
  } catch (err) {
    console.warn("[shareFile] web share failed, falling back to download", err);
  }

  // 3) Plain download.
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "download";
}

// ---------- Network ----------
export async function getNetworkStatus() {
  if (!isNative()) return { connected: navigator.onLine, connectionType: "unknown" as const };
  const { Network } = await import("@capacitor/network");
  return Network.getStatus();
}

// ---------- Status bar / splash ----------
export async function configureStatusBar() {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
    if (platform() === "android") {
      await StatusBar.setBackgroundColor({ color: "#0B1020" });
    }
  } catch {}
}

export async function hideSplash() {
  if (!isNative()) return;
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide({ fadeOutDuration: 250 });
  } catch {}
}

// ---------- Push notifications ----------
export async function registerPushNotifications(
  onToken: (token: string) => void,
  onNotification?: (n: { title?: string; body?: string; data?: any }) => void,
) {
  if (!isNative()) return { ok: false, reason: "not-native" as const };
  const { PushNotifications } = await import("@capacitor/push-notifications");

  const perm = await PushNotifications.checkPermissions();
  let status = perm.receive;
  if (status === "prompt" || status === "prompt-with-rationale") {
    const req = await PushNotifications.requestPermissions();
    status = req.receive;
  }
  if (status !== "granted") return { ok: false, reason: "denied" as const };

  await PushNotifications.register();
  PushNotifications.addListener("registration", (token) => onToken(token.value));
  PushNotifications.addListener("registrationError", (err) =>
    console.warn("Push registration error", err),
  );
  if (onNotification) {
    PushNotifications.addListener("pushNotificationReceived", (n) =>
      onNotification({ title: n.title, body: n.body, data: n.data }),
    );
    PushNotifications.addListener("pushNotificationActionPerformed", (a) =>
      onNotification({ title: a.notification.title, body: a.notification.body, data: a.notification.data }),
    );
  }
  return { ok: true as const };
}
