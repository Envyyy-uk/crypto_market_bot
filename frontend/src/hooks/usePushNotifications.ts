import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export type PushState =
  | "unsupported"   // браузер не вміє (або немає SW)
  | "unconfigured"  // сервер без VAPID-ключів
  | "denied"        // користувач заборонив сповіщення
  | "off"           // можна увімкнути
  | "on"            // підписка активна
  | "busy";

export function usePushNotifications() {
  const { token } = useAuth();
  const [state, setState] = useState<PushState>("busy");

  const refresh = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    } catch {
      setState("off");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    if (!token) return;
    setState("busy");
    try {
      // 1. Ключ сервера
      const keyRes = await fetch(`${API_BASE}/api/push/public-key`);
      if (keyRes.status === 503) {
        setState("unconfigured");
        return;
      }
      if (!keyRes.ok) throw new Error();
      const { publicKey } = await keyRes.json();

      // 2. Дозвіл користувача
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }

      // 3. Підписка браузера
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      // 4. Збереження на сервері
      const res = await fetch(`${API_BASE}/api/push/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) throw new Error();
      setState("on");
    } catch {
      setState("off");
    }
  }, [token]);

  const disable = useCallback(async () => {
    if (!token) return;
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch(`${API_BASE}/api/push/subscribe`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ subscription: sub.toJSON() }),
        });
        await sub.unsubscribe();
      }
    } finally {
      setState("off");
    }
  }, [token]);

  return { state, enable, disable };
}
