import { useEffect, useState } from "react";

/**
 * Tracks the browser's online/offline status. Updates whenever the
 * `online` / `offline` window events fire, which Capacitor proxies on
 * native builds via the system reachability API.
 */
export const useOnlineStatus = (): boolean => {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return online;
};
