import { Fragment, type ReactNode } from "react";
import { GitBranch } from "lucide-react";
import { type Model, displayName, resolveEntity } from "@/lib/atlas-data";

export function Rich({
  model,
  text,
  onOpen,
}: {
  model: Model;
  text: string;
  onOpen: (id: string) => void;
}) {
  const parts: ReactNode[] = [];
  const pattern =
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*/g;
  let end = 0;
  for (const match of text.matchAll(pattern)) {
    parts.push(text.slice(end, match.index));
    const reference = match[1] ?? match[4] ?? match[5];
    const entity = reference
      ? resolveEntity(model, reference.replace(/^#/, "").replace(/^node:/, ""))
      : undefined;
    const label = match[2] ?? match[3] ?? (entity ? displayName(entity) : reference);
    parts.push(
      entity ? (
        <button
          key={match.index}
          onClick={() => onOpen(entity.id)}
          className="font-medium text-foreground underline decoration-border-strong decoration-dotted underline-offset-4 hover:text-primary"
        >
          {label}
        </button>
      ) : match[6] ? (
        <strong key={match.index}>{match[6]}</strong>
      ) : match[5] ? (
        <code key={match.index} className="rounded border bg-surface-2 px-1 font-mono text-xs">
          {match[5]}
        </code>
      ) : match[4] && /^https?:\/\//.test(match[4]) ? (
        <a key={match.index} href={match[4]} target="_blank" rel="noreferrer" className="underline">
          {match[3]}
        </a>
      ) : (
        match[0]
      ),
    );
    end = match.index! + match[0].length;
  }
  parts.push(text.slice(end));
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>{part}</Fragment>
      ))}
    </>
  );
}
function Markdown({
  model,
  text,
  onOpen,
}: {
  model: Model;
  text: string;
  onOpen: (id: string) => void;
}) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  for (let i = 0; i < lines.length;) {
    const line = lines[i]!;
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith("```")) code.push(lines[i++]!);
      i++;
      blocks.push(
        <pre
          key={i}
          className="my-5 overflow-auto rounded-md border bg-background p-4 font-mono text-xs"
        >
          {code.join("\n")}
        </pre>,
      );
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push(
        <h2 key={i} className="mb-3 mt-8 border-b pb-2 text-[15px] font-semibold">
          <Rich model={model} text={heading[2]!} onOpen={onOpen} />
        </h2>,
      );
      i++;
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: ReactNode[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i]!)) {
        items.push(
          <li key={i}>
            <Rich
              model={model}
              text={lines[i++]!.replace(/^\s*([-*]|\d+\.)\s+/, "")}
              onOpen={onOpen}
            />
          </li>,
        );
      }
      const props = { className: "my-3 list-inside space-y-2 text-sm leading-6", children: items };
      blocks.push(
        ordered ? (
          <ol key={i} {...props} className={`${props.className} list-decimal`} />
        ) : (
          <ul key={i} {...props} className={`${props.className} list-disc`} />
        ),
      );
      continue;
    }
    const paragraph: string[] = [line];
    i++;
    while (i < lines.length && lines[i]!.trim() && !/^(#|```|[-*]\s|\d+\.\s)/.test(lines[i]!))
      paragraph.push(lines[i++]!);
    blocks.push(
      <p key={i} className="my-3 text-[14px] leading-7 text-secondary-foreground">
        <Rich model={model} text={paragraph.join(" ")} onOpen={onOpen} />
      </p>,
    );
  }
  return <>{blocks}</>;
}
export function DocsView({
  model,
  contextId,
  onOpen,
}: {
  model: Model;
  contextId: string;
  onOpen: (id: string) => void;
}) {
  const e = model.entities[contextId]!;
  const children = Object.values(model.entities).filter((n) => n.parent === contextId);
  const rels = model.relationships.filter((r) => r.source === contextId || r.target === contextId);
  const text = model.documentation[contextId]?.replace(/^# [^\n]+\n/, "");
  return (
    <div className="scrollbar-thin h-full overflow-auto bg-surface">
      <article
        key={contextId}
        className="mx-auto max-w-3xl px-10 py-12 animate-in fade-in duration-300"
      >
        <div className="mb-6 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="rounded-sm border border-primary/30 bg-primary/10 px-2 py-0.5 text-primary">
            From project JSON
          </span>
          <span className="flex items-center gap-1.5">
            <GitBranch className="size-3.5" />
            {e.type}
          </span>
          {e.repo && <span className="font-mono text-faint">{e.repo}</span>}
        </div>
        <h1 className="text-[28px] font-semibold tracking-tight">{displayName(e)}</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {[e.stack, e.domain, e.file].filter(Boolean).join(" · ")}
        </p>
        {e.description && <p className="mt-5 text-sm leading-7">{e.description}</p>}
        {text ? (
          <Markdown model={model} text={text} onOpen={onOpen} />
        ) : (
          <p className="mt-5 text-sm text-muted-foreground">
            No written documentation for this entity. The relationships and children below come from
            the loaded project.
          </p>
        )}
        {children.length > 0 && (
          <>
            <h2 className="mb-3 mt-9 border-b pb-2 text-[15px] font-semibold">Contains</h2>
            <div className="divide-y rounded-md border bg-card">
              {children.map((n) => (
                <button
                  key={n.id}
                  onClick={() => onOpen(n.id)}
                  className="flex w-full justify-between px-4 py-3 text-left text-sm hover:bg-accent"
                >
                  <span>{displayName(n)}</span>
                  <span className="text-xs text-faint">{n.type}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {rels.length > 0 && (
          <>
            <h2 className="mb-3 mt-9 border-b pb-2 text-[15px] font-semibold">Relationships</h2>
            <div className="divide-y rounded-md border bg-card">
              {rels.map((r, i) => {
                const outgoing = r.source === contextId;
                const other = model.entities[outgoing ? r.target : r.source]!;
                return (
                  <button
                    key={i}
                    onClick={() => onOpen(other.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-accent"
                  >
                    <span className="text-xs text-faint">
                      {outgoing ? "→" : "←"} {r.label ?? r.type}
                    </span>
                    <span>{displayName(other)}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </article>
    </div>
  );
}
