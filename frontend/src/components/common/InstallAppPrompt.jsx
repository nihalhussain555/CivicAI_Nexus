import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";

const DISMISS_KEY = "civicai_install_prompt_dismissed";

const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

const InstallAppPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === "true"
  );

  useEffect(() => {
    if (isStandalone()) return; // already installed — nothing to prompt

    const handler = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS Safari never fires beforeinstallprompt — there's no programmatic
    // install API there, only the manual Share -> Add to Home Screen flow.
    if (isIos()) setShowIosHint(true);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  if (dismissed || isStandalone()) return null;
  if (!deferredPrompt && !showIosHint) return null;

  return (
    <div className="install-app-banner">
      <div className="install-app-banner-text">
        <strong>Install CivicAI Nexus</strong>
        <span>
          {deferredPrompt
            ? "Add it to your home screen for quick, app-like access."
            : (
              <>Tap <Share size={12} style={{ verticalAlign: "-2px" }} /> Share, then "Add to Home Screen".</>
            )}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {deferredPrompt && (
          <button className="btn btn-primary btn-sm" onClick={install}>
            <Download size={13} /> Install
          </button>
        )}
        <button className="icon-button" aria-label="Dismiss" onClick={dismiss}>
          <X size={15} />
        </button>
      </div>
    </div>
  );
};

export default InstallAppPrompt;