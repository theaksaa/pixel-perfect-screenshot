import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUp, Waypoints, CornerDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { defaultSuggestions, entities, fakeAnswer, suggestions } from "@/lib/atlas-data";

export interface Msg {
  role: "user" | "ai";
  text: string;
  ctx: string;
  highlight?: string[];
}

function inline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`)/g).map((p, i) =>
    p.startsWith("`") ? (
      <code key={i} className="rounded-sm bg-surface-2 px-1 py-px font-mono text-[11.5px] text-foreground">{p.slice(1, -1)}</code>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

interface Props {
  contextId: string;
  onShowOnGraph: (ctx: string, keys: string[]) => void;
}

export function Assistant({ contextId, onShowOnGraph }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const ctxName = entities[contextId]!.name;

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages, thinking]);

  const ask = (q: string) => {
    if (!q.trim() || thinking) return;
    setMessages((m) => [...m, { role: "user", text: q, ctx: contextId }]);
    setInput("");
    setThinking(true);
    setTimeout(() => {
      const a = fakeAnswer(q, contextId);
      setMessages((m) => [...m, { role: "ai", text: a.text, ctx: contextId, highlight: a.highlight }]);
      setThinking(false);
    }, 900);
  };

  const sugg = suggestions[contextId] ?? defaultSuggestions;

  return (
    <aside className="flex h-full flex-col border-l bg-background">
      <div className="flex h-11 shrink-0 items-center justify-between border-b px-4">
        <span className="flex items-center gap-2 text-[13px] font-medium">
          <Waypoints className="size-3.5 text-primary" /> AI Assistant
        </span>
        <span className="max-w-[55%] truncate rounded-sm border bg-surface px-1.5 py-0.5 text-[11px] text-muted-foreground">
          Context: <span className="text-foreground">{ctxName}</span>
        </span>
      </div>

      <div className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="pt-2">
            <p className="text-[13px] text-foreground">Ask anything about <span className="font-medium">{ctxName}</span>.</p>
            <p className="mt-1 text-xs text-muted-foreground">Answers are grounded in the indexed source of 14 repositories.</p>
            <div className="mt-5 space-y-1">
              <p className="mb-2 text-[11px] uppercase tracking-wider text-faint">Suggested</p>
              {sugg.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-[12.5px] text-muted-foreground transition-colors hover:border-border hover:bg-surface hover:text-foreground"
                >
                  <CornerDownRight className="size-3 shrink-0 text-faint" /> {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[90%] rounded-md bg-secondary px-3 py-2 text-[12.5px] text-secondary-foreground">{m.text}</div>
            </div>
          ) : (
            <div key={i} className="space-y-2 text-[12.5px] leading-[1.6] text-secondary-foreground">
              <div className="flex items-center gap-1.5 text-[11px] text-faint">
                <Waypoints className="size-3 text-primary" /> Atlas · {entities[m.ctx]!.name}
              </div>
              {m.text.split("\n\n").map((p, j) => <p key={j}>{inline(p)}</p>)}
              {m.highlight && (
                <button
                  onClick={() => onShowOnGraph(m.ctx, m.highlight!)}
                  className="inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[11.5px] text-primary transition-colors hover:border-primary/50 hover:bg-primary/10"
                >
                  <Waypoints className="size-3" /> Show on graph
                </button>
              )}
            </div>
          ),
        )}
        {thinking && (
          <div className="flex items-center gap-1.5 text-[12px] text-faint">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" /> Reading {ctxName}…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); ask(input); }}
        className="m-3 rounded-md border bg-surface focus-within:border-border-strong"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); } }}
          rows={2}
          placeholder="Ask about this architecture..."
          className="block w-full resize-none bg-transparent px-3 pt-2.5 text-[12.5px] placeholder:text-faint focus:outline-none"
        />
        <div className="flex items-center justify-between px-2 pb-2">
          <span className="font-mono text-[10.5px] text-faint">@{contextId}</span>
          <button
            type="submit"
            disabled={!input.trim()}
            className={cn("flex size-6 items-center justify-center rounded-sm transition-colors", input.trim() ? "bg-primary text-primary-foreground" : "bg-muted text-faint")}
            aria-label="Send"
          >
            <ArrowUp className="size-3.5" />
          </button>
        </div>
      </form>
    </aside>
  );
}
