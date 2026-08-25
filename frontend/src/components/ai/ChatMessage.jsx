import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders assistant/user chat text as markdown (bold, lists, occasional
 * tables) instead of showing raw '**' / '|' characters. Kept deliberately
 * compact/dense since it lives inside a small chat bubble, not a document.
 */
const ChatMessage = ({ text }) => (
  <div className="chat-markdown">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" />,
      }}
    >
      {text}
    </ReactMarkdown>
  </div>
);

export default ChatMessage;