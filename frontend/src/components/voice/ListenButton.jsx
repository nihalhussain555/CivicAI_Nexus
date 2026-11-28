import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { onVoicesChanged, speak, speechSupported, stopSpeaking, voicesFor } from "../../utils/speech";
import { useDiagnostics } from "../../hooks/useDiagnostics";

/**
 * Reads one assistant reply aloud, in the language the reply was written in.
 *
 * The button disappears entirely on a device with no voice for that language
 * rather than greying out mid-conversation: a Tamil reply has no reason to
 * offer a Tamil button on a machine that cannot pronounce it, and the text is
 * already on screen either way.
 *
 * A device with no speech engine at all is different — the citizen deserves to
 * know why nothing happens — so that case keeps a disabled button carrying the
 * reason. Silence is only acceptable when the citizen chose it.
 */

const NOTICES = {
  unsupported: "This browser has no text-to-speech engine, so replies cannot be read aloud.",
  no_voice: "No voice for this language is installed on this device.",
  never_started: "The voice was asked to speak but never started.",
  autoplay: "The browser blocked the reply from playing on its own. Tap to listen.",
  refused: "The browser refused to play this reply.",
};

// Chrome and Safari raise no error when an utterance is silently dropped: the
// only sign is `onstart` never firing.
const START_WATCHDOG_MS = 1500;

const ListenButton = ({ text, locale = "en-IN", autoPlay = false, label = "Listen" }) => {
  const supported = speechSupported();
  const [playing, setPlaying] = useState(false);
  const [canSpeak, setCanSpeak] = useState(() => voicesFor(locale).length > 0);
  const [notice, setNotice] = useState(null);
  const { capture } = useDiagnostics();

  // Each attempt owns a number. Cancelling an utterance fires `onerror` on the
  // utterance it replaced, and a citizen pressing Stop is not a fault worth a
  // diagnostics row — the number is what tells the two apart.
  const session = useRef(0);
  const stopped = useRef(0);
  const started = useRef(false);
  const audible = useRef(false);
  const watchdog = useRef(null);

  useEffect(() => {
    if (!supported) return undefined;
    if (voicesFor(locale).length) setCanSpeak(true);
    return onVoicesChanged((voices) => {
      const prefix = String(locale).toLowerCase().slice(0, 2);
      setCanSpeak(voices.some((v) => String(v.lang || "").toLowerCase().startsWith(prefix)));
    });
  }, [locale, supported]);

  const clearWatchdog = () => clearTimeout(watchdog.current);

  const stop = () => {
    stopped.current = session.current;
    audible.current = false;
    clearWatchdog();
    stopSpeaking();
    setPlaying(false);
  };

  // A reply that is still being read when its button goes away should not
  // outlive it; one that never started has nothing left to cancel.
  useEffect(() => () => {
    stopped.current = session.current;
    clearWatchdog();
    if (audible.current) stopSpeaking();
  }, []);

  const report = (detail, code) => {
    setPlaying(false);
    setNotice(code === "never_started" ? NOTICES.never_started : NOTICES.refused);
    capture(null, {
      feature: "text_to_speech",
      category: "voice",
      message: detail,
      technical: { speechError: code || "unknown", locale },
    });
  };

  const begin = (autoplayAttempt) => {
    const id = ++session.current;
    const stale = () => id !== session.current || stopped.current === id;
    started.current = false;
    setNotice(null);

    let queued = false;
    let thrown = null;
    try {
      queued = speak(text, locale, {
        onStart: () => {
          if (stale()) return;
          started.current = true;
          audible.current = true;
          clearWatchdog();
          setPlaying(true);
        },
        onEnd: () => {
          clearWatchdog();
          audible.current = false;
          if (!stale()) setPlaying(false);
        },
        onError: (event) => {
          clearWatchdog();
          audible.current = false;
          if (stale()) return; // a Stop, or a reply that replaced this one
          report(`speechSynthesis error: ${event?.error || "unknown"}`, event?.error);
        },
      });
    } catch (error) {
      thrown = error;
    }

    if (thrown) {
      capture(thrown, { feature: "text_to_speech", category: "voice" });
      setPlaying(false);
      setNotice(NOTICES.refused);
      return;
    }

    if (!queued) {
      setPlaying(false);
      if (!supported) {
        setNotice(NOTICES.unsupported);
        return;
      }
      if (!voicesFor(locale).length) {
        // The voice list changed between render and click: the button has
        // nothing to offer, which is a device fact rather than a failure.
        setNotice(NOTICES.no_voice);
        if (autoplayAttempt) setCanSpeak(false);
        return;
      }
      report("speechSynthesis accepted the utterance and played nothing", "no-utterance");
      return;
    }

    clearWatchdog();
    watchdog.current = setTimeout(() => {
      if (stale() || started.current) return;
      clearWatchdog();
      setPlaying(false);
      if (autoplayAttempt) {
        // A policy decision by the browser, not a platform fault: say so, and
        // let the citizen start it themselves with one tap.
        setNotice(NOTICES.autoplay);
        capture(null, {
          feature: "text_to_speech",
          category: "voice",
          message: "autoplay policy prevented speechSynthesis from starting",
          technical: { speechError: "autoplay-blocked", locale },
        });
        return;
      }
      report("speechSynthesis queued an utterance that never started", "never_started");
    }, START_WATCHDOG_MS);
  };

  useEffect(() => {
    if (!autoPlay || !canSpeak) return undefined;
    begin(true);
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, canSpeak, locale, text]);

  if (!supported) {
    return (
      <button
        type="button"
        className="listen-button"
        disabled
        aria-label={NOTICES.unsupported}
        title={NOTICES.unsupported}
      >
        <VolumeX size={13} />
      </button>
    );
  }

  if (!canSpeak) return null;

  const toggle = () => {
    if (playing) {
      stop();
      return;
    }
    setPlaying(true);
    begin(false);
  };

  const hint = notice || (playing ? "Stop" : label);

  return (
    <button
      type="button"
      className="listen-button"
      onClick={toggle}
      aria-label={notice || (playing ? "Stop playing the reply" : `Play the reply${locale ? ` in ${locale}` : ""}`)}
      aria-pressed={playing}
      title={hint}
    >
      {playing ? <VolumeX size={13} /> : <Volume2 size={13} />}
    </button>
  );
};

export default ListenButton;
