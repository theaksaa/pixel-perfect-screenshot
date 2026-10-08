import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight, Network, FileText, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { entities, pathFor, PLATFORM_ID } from "@/lib/atlas-data";
import { TopNav } from "@/components/atlas/TopNav";
import { GraphView, type Filter } from "@/components/atlas/GraphView";
import { DocsView } from "@/components/atlas/DocsView";
import { Assistant } from "@/components/atlas/Assistant";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Code Atlas — Architecture explorer" },
      { name: "description", content: "Explore services, APIs, events and dependencies across a large microservice system." },
      { property: "og:title", content: "Code Atlas — Architecture explorer" },
      { property: "og:description", content: "Navigate architecture graphs, generated docs and ask an AI about any service." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Atlas,
});

function Atlas() {
  const [ctx, setCtx] = useState(PLATFORM_ID);
  const [history, setHistory] = useState<string[]>([]);
  const [mode, setMode] = useState<"graph" | "docs">("graph");
  const [filter, setFilter] = useState<Filter>("all");
  const [highlight, setHighlight] = useState<string[]>([]);

  const open = (id: string) => {
    if (id === ctx) return;
    setHistory((h) => [...h, ctx]);
    setCtx(id);
    setHighlight([]);
  };
  const back = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setCtx(prev);
    setHighlight([]);
  };

  const crumbs = pathFor(ctx);
  const e = entities[ctx]!;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopNav onOpen={open} />

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-10 shrink-0 items-center justify-between border-b px-4">
            <nav className="flex items-center gap-1 text-[12.5px]">
              <button onClick={back} disabled={!history.length} className="mr-1 rounded-sm p-1 text-faint enabled:hover:bg-surface enabled:hover:text-foreground disabled:opacity-40" aria-label="Back">
                <ArrowLeft className="size-3.5" />
              </button>
              {crumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="size-3 text-faint" />}
                  {i === crumbs.length - 1 ? (
                    <span className="rounded-sm px-1.5 py-0.5 font-medium text-foreground">{c.label}</span>
                  ) : (
                    <button onClick={() => c.id && open(c.id)} className="rounded-sm px-1.5 py-0.5 text-muted-foreground hover:bg-surface hover:text-foreground">
                      {c.label}
                    </button>
                  )}
                </span>
              ))}
              {e.repo && <span className="ml-2 font-mono text-[11px] text-faint">{e.repo}</span>}
            </nav>

            <div className="flex rounded-md border bg-surface p-0.5">
              {([["graph", "Graph", Network], ["docs", "Documentation", FileText]] as const).map(([m, label, Icon]) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs transition-colors",
                    mode === m ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5" /> {label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1">
            {mode === "graph" ? (
              <GraphView contextId={ctx} contextName={e.name} filter={filter} onFilter={setFilter} highlight={highlight} onOpen={open} />
            ) : (
              <DocsView contextId={ctx} onOpen={open} />
            )}
          </div>
        </main>

        <div className="w-[21%] min-w-[300px] shrink-0">
          <Assistant
            contextId={ctx}
            onShowOnGraph={(c, keys) => {
              if (c !== ctx) open(c);
              setMode("graph");
              setFilter("all");
              setTimeout(() => setHighlight(keys), 0);
            }}
          />
        </div>
      </div>
    </div>
  );
}
