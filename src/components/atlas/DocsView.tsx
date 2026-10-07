import { Fragment, type ReactNode } from "react";
import { GitBranch, Sparkles as _unused } from "lucide-react";
import { docFor, entities } from "@/lib/atlas-data";

void _unused;

function Rich({ text, onOpen }: { text: string; onOpen: (id: string) => void }) {
  const parts: ReactNode[] = [];
  const re = /\[\[(\w+)(?:\|([^\]]+))?\]\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    parts.push(text.slice(last, m.index));
    const id = m[1];
    parts.push(<EntityLink key={m.index} id={id} label={m[2]} onOpen={onOpen} />);
    last = m.index + m[0].length;
  }
  parts.push(text.slice(last));
  return <>{parts.map((p, i) => <Fragment key={i}>{p}</Fragment>)}</>;
}

function EntityLink({ id, label, onOpen }: { id: string; label?: string; onOpen: (id: string) => void }) {
  return (
    <button
      onClick={() => onOpen(id)}
      className="font-medium text-foreground underline decoration-border-strong decoration-dotted underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
    >
      {label ?? entities[id]?.name ?? id}
    </button>
  );
}

const H2 = ({ children }: { children: ReactNode }) => (
  <h2 className="mb-3 mt-9 border-b pb-2 text-[15px] font-semibold tracking-tight">{children}</h2>
);

const Code = ({ children }: { children: ReactNode }) => (
  <code className="rounded-sm border bg-surface-2 px-1.5 py-0.5 font-mono text-[12px] text-foreground">{children}</code>
);

export function DocsView({ contextId, onOpen }: { contextId: string; onOpen: (id: string) => void }) {
  const e = entities[contextId];
  const d = docFor(contextId);
  return (
    <div className="scrollbar-thin h-full overflow-auto bg-surface">
      <article key={contextId} className="mx-auto max-w-3xl px-10 py-12 animate-in fade-in duration-300">
        <div className="mb-6 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="rounded-sm border border-primary/30 bg-primary/10 px-2 py-0.5 text-primary">✦ Generated from source code</span>
          <span className="flex items-center gap-1.5"><GitBranch className="size-3.5" /> Updated from <span className="font-mono">main</span> · 8 minutes ago</span>
          {e.repo && <span className="font-mono text-faint">{e.repo}</span>}
        </div>
        <h1 className="text-[28px] font-semibold tracking-tight">{e.name}</h1>
        {e.stack && <p className="mt-1 text-[13px] text-muted-foreground">{e.stack} · {e.domain}</p>}
        <p className="mt-5 text-[14.5px] leading-7 text-secondary-foreground">
          <Rich text={d.summary} onOpen={onOpen} />
        </p>

        <H2>Responsibilities</H2>
        <ul className="list-disc space-y-1.5 pl-5 text-[14px] leading-6 text-secondary-foreground marker:text-faint">
          {d.responsibilities.map((r) => <li key={r}>{r}</li>)}
        </ul>

        {d.dependencies.length > 0 && (
          <>
            <H2>{contextId === "platform" ? "Key components" : "Dependencies"}</H2>
            <dl className="divide-y rounded-md border bg-card">
              {d.dependencies.map((dep) => (
                <div key={dep.id} className="flex items-baseline gap-4 px-4 py-3">
                  <dt className="w-44 shrink-0 text-[13.5px]"><EntityLink id={dep.id} onOpen={onOpen} /></dt>
                  <dd className="text-[13.5px] text-muted-foreground">{dep.text}</dd>
                </div>
              ))}
            </dl>
          </>
        )}

        {d.apis && (
          <>
            <H2>APIs</H2>
            <div className="divide-y rounded-md border bg-card font-mono text-[12.5px]">
              {d.apis.map((a) => {
                const [m, p] = a.split(" ");
                return (
                  <div key={a} className="flex items-center gap-3 px-4 py-2">
                    <span className={m === "GET" ? "w-12 text-edge-grpc" : "w-12 text-edge-rest"}>{m}</span>
                    <span>{p}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {(d.produces || d.consumes) && (
          <>
            <H2>Events</H2>
            <div className="grid grid-cols-2 gap-6 text-[13.5px]">
              {d.produces && (
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wider text-faint">Produces</p>
                  <div className="flex flex-wrap gap-2">{d.produces.map((t) => <Code key={t}>{t}</Code>)}</div>
                </div>
              )}
              {d.consumes && (
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wider text-faint">Consumes</p>
                  <div className="flex flex-wrap gap-2">{d.consumes.map((t) => <Code key={t}>{t}</Code>)}</div>
                </div>
              )}
            </div>
          </>
        )}

        {d.flows && (
          <>
            <H2>Important flows</H2>
            {d.flows.map((f) => (
              <div key={f.name} className="mb-4">
                <p className="mb-2 text-[14px] font-medium">{f.name}</p>
                <pre className="overflow-x-auto rounded-md border bg-background px-4 py-3 font-mono text-[12px] text-muted-foreground">
                  {f.steps.join("  →  ")}
                </pre>
              </div>
            ))}
          </>
        )}
      </article>
    </div>
  );
}
