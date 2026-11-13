import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { onVoicesChanged, speak, stopSpeaking, voicesFor } from "../../utils/speech";

/**
 * Reads one assistant reply aloud, in the language the reply was written in.
 *
 * The button disappears entirely on a device with no voice for that language
 * rather than greying out mid-conversation: a Tamil reply has no reason to
 * offer a Tamil button on a machine that cannot pronounce it, and the text is
 * already on screen either way.
 */
const ListenButton = ({ text, locale = "en-IN", autoPlay = false, label = "Listen" }) => {
  const [playing, setPlaying] = useState(false);
  const [canSpeak, setCanSpeak] = useState(() => voicesFor(locale).length > 0);

  useEffect(() => {
    if (voicesFor(locale).length) setCanSpeak(true);
    return onVoicesChanged((voices) => {
      const prefix = String(locale).toLowerCase().slice(0, 2);
      setCanSpeak(voices.some((v) => String(v.lang || "").toLowerCase().startsWith(prefix)));
    });
  }, [locale]);

  useEffect(() => {
    if (!autoPlay || !canSpeak) return undefined;
    const started = speak(text, locale, { onEnd: () => setPlaying(false), onError: () => setPlaying(false) });
    if (!started) setCanSpeak(false);
    return () => stopSpeaking();
  }, [autoPlay, canSpeak, locale, text]);

  if (!canSpeak) return null;

  const toggle = () => {
    if (playing) {
      stopSpeaking();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    const started = speak(text, locale, {
      onEnd: () => setPlaying(false),
      onError: () => setPlaying(false),
    });
    if (!started) setPlaying(false);
  };

  return (
    <button
      type="button"
      className="listen-button"
      onClick={toggle}
      aria-label={playing ? "Stop playing the reply" : `Play the reply${locale ? ` in ${locale}` : ""}`}
      aria-pressed={playing}
      title={playing ? "Stop" : label}
    >
      {playing ? <VolumeX size={13} /> : <Volume2 size={13} />}
    </button>
  );
};

export default ListenButton;
