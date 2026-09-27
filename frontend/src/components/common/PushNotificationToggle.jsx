import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { getVapidPublicKey, subscribePush, unsubscribePush } from "../../services/pushService";
import { useToast } from "../../context/ToastContext";

// The browser's pushManager.subscribe() needs the VAPID public key as raw
// bytes, not the base64url string the backend hands out.
const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

const isSupported = () => "serviceWorker" in navigator && "PushManager" in window;

const PushNotificationToggle = () => {
  const [status, setStatus] = useState("checking"); // checking | unsupported | denied | off | on
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!isSupported()) { setStatus("unsupported"); return; }
    if (Notification.permission === "denied") { setStatus("denied"); return; }

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setStatus(sub ? "on" : "off"))
      .catch(() => setStatus("off"));
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const keyRes = await getVapidPublicKey();
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyRes.data.public_key),
      });

      const raw = subscription.toJSON();
      await subscribePush({ endpoint: raw.endpoint, keys: raw.keys });

      setStatus("on");
      toast.success("Push notifications enabled");
    } catch (error) {
      toast.error("Couldn't enable push notifications — please try again.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();
      if (subscription) {
        await unsubscribePush(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setStatus("off");
      toast.success("Push notifications turned off");
    } catch (error) {
      toast.error("Couldn't turn off push notifications.");
    } finally {
      setBusy(false);
    }
  };

  if (status === "unsupported") {
    return <p className="form-hint">Push notifications aren't supported in this browser.</p>;
  }

  if (status === "denied") {
    return (
      <p className="form-hint">
        Notifications are blocked for this site in your browser settings — enable them there to turn this on.
      </p>
    );
  }

  if (status === "checking") return null;

  return (
    <button
      className={`btn ${status === "on" ? "btn-secondary" : "btn-primary"}`}
      disabled={busy}
      onClick={status === "on" ? disable : enable}
    >
      {status === "on" ? <><BellOff size={14} /> Turn off</> : <><BellRing size={14} /> Enable</>}
    </button>
  );
};

export default PushNotificationToggle;