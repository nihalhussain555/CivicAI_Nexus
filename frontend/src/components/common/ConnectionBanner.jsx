import { useEffect, useRef, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { useToast } from "../../context/ToastContext";
import { diagnose } from "../../utils/errorDiagnosis";
import { reportClientError } from "../../services/diagnosticService";

/*
 * Connectivity is the one failure the backend cannot report: by the time it
 * would fire, the request is already going nowhere. So the browser owns it —
 * including the recovery, which is the part users otherwise never trust again.
 */

const ConnectionBanner = () => {
  const [offline, setOffline] = useState(
    typeof navigator === "undefined" ? false : navigator.onLine === false
  );
  const toast = useToast();
  const settled = useRef(false);

  useEffect(() => {
    const goOffline = () => {
      setOffline(true);
      const diagnosis = diagnose(new Error("The device went offline during use"), {
        feature: "network",
        category: "network",
      });
      reportClientError(diagnosis);
    };
    const goOnline = () => {
      setOffline(false);
      // The first "online" the browser fires on page load is not a recovery,
      // and toasting it would greet every user with noise.
      if (settled.current) toast.success("Back online — you can continue where you left off.");
      settled.current = true;
    };

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, [toast]);

  if (!offline) return null;

  return (
    <div className="connection-banner" role="alert">
      <WifiOff size={15} />
      <span>
        <strong>You are offline.</strong> Requests cannot reach the server right now.
        Anything you have typed on this page is still here.
      </span>
      <Wifi size={14} className="connection-banner-check" />
    </div>
  );
};

export default ConnectionBanner;
