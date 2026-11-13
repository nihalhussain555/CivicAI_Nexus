/**
 * Text-to-speech for the voice assistant, on the browser's own
 * SpeechSynthesis engine.
 *
 * Deliberately no cloud TTS: every mainstream browser and Android WebView
 * already ships Indic voices, it costs the deployment nothing, and the audio
 * never leaves the citizen's device — which matters when the sentence being
 * read out is their own complaint.
 *
 * The one thing callers must handle honestly is a device with no voice for
 * the reply's language: `voicesFor` returns empty and the UI keeps the text.
 * Silently reading Tamil words with an English voice is worse than saying
 * nothing.
 */

const synth = typeof window !== "undefined" ? window.speechSynthesis : null;

let cached = [];

function refresh() {
  cached = synth ? synth.getVoices() || [] : [];
  return cached;
}

export const speechSupported = () => Boolean(synth);

/** Voices able to speak `locale` ("ta-IN"): exact match first, then any voice
 * sharing the language, since a Tamil voice labelled "ta-IN" or "ta" both
 * pronounce it correctly and the tag varies by browser. */
export const voicesFor = (locale) => {
  if (!synth) return [];
  const pool = cached.length ? cached : refresh();
  const language = String(locale || "").toLowerCase().slice(0, 2);
  if (!language) return [];
  const normalized = (v) => String(v.lang || "").replace("_", "-").toLowerCase();
  return [
    ...pool.filter((v) => normalized(v) === String(locale).toLowerCase()),
    ...pool.filter((v) => normalized(v).startsWith(language) && normalized(v) !== String(locale).toLowerCase()),
  ];
};

/** Browsers populate the voice list asynchronously on first use. */
export const onVoicesChanged = (callback) => {
  if (!synth) {
    callback([]);
    return () => {};
  }
  const handler = () => callback(refresh());
  refresh();
  if (cached.length) {
    callback(cached);
    return () => {};
  }
  synth.addEventListener("voiceschanged", handler);
  return () => synth.removeEventListener("voiceschanged", handler);
};

/** Speak `text`. Returns false when nothing was said — unsupported browser,
 * no voice for the language, or empty text — so the caller can say so. */
export const speak = (text, locale, { onStart, onEnd, onError } = {}) => {
  if (!synth || !text || !text.trim()) return false;
  const voice = voicesFor(locale)[0] || null;
  if (!voice) return false;

  synth.cancel(); // one utterance at a time: a chat reply interrupts the last
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang || locale;
  utterance.rate = 0.95; // slightly slower: these are official responses
  utterance.onstart = onStart || null;
  utterance.onend = onEnd || null;
  utterance.onerror = onError || null;
  synth.speak(utterance);
  return true;
};

export const stopSpeaking = () => {
  if (synth) synth.cancel();
};
