import { useEffect } from "react";
import ConnectionBanner from "./ConnectionBanner";
import { useToast } from "../../context/ToastContext";
import { diagnose } from "../../utils/errorDiagnosis";
import {
  installConnectivityCapture,
  installGlobalErrorCapture,
} from "../../services/diagnosticService";

/*
 * Last line of capture: a throw nobody caught, or a promise nobody handled,
 * used to disappear into the console. Both are now classified, reported, and
 * shown — which is the difference between an error we hear about and one we
 * never learn existed.
 */

const GlobalErrorWatcher = () => {
  const toast = useToast();

  useEffect(() => {
    const stopErrors = installGlobalErrorCapture({
      onError: (error, label) => {
        const diagnosis = diagnose(error, {
          feature: "page_render",
          technical: { origin: label },
        });
        toast.diagnosis(diagnosis);
      },
    });

    const stopConnectivity = installConnectivityCapture({
      onChange: (online) => {
        if (online) return;
        toast.error("Your connection dropped.", {
          diagnosis: diagnose(new Error("Connection lost"), {
            feature: "network",
            category: "network",
          }),
        });
      },
    });

    return () => {
      stopErrors();
      stopConnectivity();
    };
  }, [toast]);

  return <ConnectionBanner />;
};

export default GlobalErrorWatcher;
