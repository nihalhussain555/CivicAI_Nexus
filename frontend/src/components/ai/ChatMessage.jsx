import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders assistant/user chat text as markdown (bold, lists, occasional
 * tables) instead of showing raw '**' / '|' characters. Kept deliberately
 * compact/dense since it lives inside a small chat bubble, not a document.
 *
 * `language` is what the reply was written in, shown as a badge so a citizen
 * who dictated in Tamil can see that it was understood as Tamil, and `code`
 * goes on the element as `lang` so a screen reader switches pronunciation
 * instead of reading Tamil letters as English. `children` renders in that
 * same strip (playback, the recording it came from).
 */
const ChatMessage = ({ text, language, code, children }) => (
  <div className="chat-markdown" lang={code ? String(code).toLowerCase() : undefined}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" />,
      }}
    >
      {text}
    </ReactMarkdown>

    {(language || children) && (
      <div className="message-meta">
        {language && <span className="message-lang">{language}</span>}
        {children}
      </div>
    )}
  </div>
);

export default ChatMessage;