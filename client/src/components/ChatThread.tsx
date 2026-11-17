import { useEffect, useRef } from "react";
import type { Draft } from "../hooks/useChats";
import type { Message } from "../types";
import { AnswerView } from "./AnswerView";

interface Props {
  messages: Message[];
  draft: Draft | null;
  onSuggest: (q: string) => void;
}

const Question = ({ text }: { text: string }) => (
  <div className="ml-auto max-w-[85%] rounded-lg bg-blue-600 px-3 py-2 text-sm text-white">{text}</div>
);

export function ChatThread({ messages, draft, onSuggest }: Props) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" }); // braces: an effect must not return scrollIntoView's value
  }, [messages, draft]);

  if (!messages.length && !draft) {
    return <p className="py-8 text-center text-sm text-slate-500">Ask anything about your saved notes and links.</p>;
  }
  return (
    <div className="max-h-[60vh] space-y-4 overflow-y-auto py-3 pr-1">
      {messages.map((m, i) =>
        m.role === "user" ? (
          <Question key={m.id} text={m.content} />
        ) : (
          <AnswerView
            key={m.id}
            idPrefix={m.id}
            answer={m.content}
            sources={m.sources}
            debug={m.debug}
            suggestions={i === messages.length - 1 ? m.suggestions : []}
            expandSources={i === messages.length - 1}
            onSuggest={onSuggest}
          />
        ),
      )}
      {draft && (
        <>
          <Question text={draft.question} />
          <p className="whitespace-pre-wrap text-sm">{draft.text || <span className="text-slate-400">Thinking…</span>}</p>
        </>
      )}
      <div ref={end} />
    </div>
  );
}
