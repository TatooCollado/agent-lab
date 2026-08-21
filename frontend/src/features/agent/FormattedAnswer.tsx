import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function FormattedAnswer({ answer }: { answer: string }) {
  return <div className="formatted-answer"><Markdown remarkPlugins={[remarkGfm]}>{answer}</Markdown></div>;
}
