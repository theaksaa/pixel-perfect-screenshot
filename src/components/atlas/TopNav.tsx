import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search, Check } from "lucide-react";
import { entities } from "@/lib/atlas-data";

const projects = ["Acme Commerce Platform", "Acme Internal Tools", "Logistics Core"];

export function TopNav({ onOpen }: { onOpen: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const [projOpen, setProjOpen] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); ref.current?.focus(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const results = Object.values(entities).filter((e) => e.id !== "platform" && (q === "" || `${e.name} ${e.stack} ${e.domain}`.toLowerCase().includes(q.toLowerCase())));

  return (
    <header className="flex h-12 shrink-0 items-center gap-4 border-b bg-background px-4">
      <div className="flex items-center gap-2">
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <rect x="7" y="1" width="4" height="4" rx="1" fill="var(--primary)" />
          <rect x="1" y="13" width="4" height="4" rx="1" fill="var(--foreground)" />
          <rect x="13" y="13" width="4" height="4" rx="1" fill="var(--foreground)" />
          <path d="M9 5 V9 H3 V13 M9 9 H15 V13" stroke="var(--faint)" strokeWidth="1.2" fill="none" />
        </svg>
        <span className="text-[13.5px] font-semibold tracking-tight">Code Atlas</span>
      </div>
      <span className="text-border-strong">/</span>
      <div className="relative">
        <button onClick={() => setProjOpen((o) => !o)} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] hover:bg-surface">
          <span className="text-muted-foreground">Project:</span> Acme Commerce Platform
          <ChevronDown className="size-3.5 text-faint" />
        </button>
        {projOpen && (
          <div className="absolute left-0 top-9 z-30 w-64 rounded-md border bg-popover p-1 shadow-xl animate-in fade-in zoom-in-95">
            {projects.map((p, i) => (
              <button key={p} onClick={() => setProjOpen(false)} className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-[13px] hover:bg-accent">
                <span>{p}<span className="ml-2 font-mono text-[11px] text-faint">{[14, 6, 9][i]} repos</span></span>
                {i === 0 && <Check className="size-3.5 text-primary" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative mx-auto w-full max-w-md">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
        <input
          ref={ref}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setTimeout(() => setFocus(false), 150)}
          placeholder="Search services, APIs, topics, components..."
          className="h-8 w-full rounded-md border bg-surface pl-8 pr-12 text-[12.5px] placeholder:text-faint focus:border-border-strong focus:outline-none"
        />
        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm border px-1 font-mono text-[10px] text-faint">⌘K</kbd>
        {focus && (
          <div className="absolute left-0 right-0 top-10 z-30 rounded-md border bg-popover p-1 shadow-xl">
            {results.length === 0 && <p className="px-2 py-2 text-xs text-muted-foreground">No matches</p>}
            {results.map((e) => (
              <button
                key={e.id}
                onMouseDown={() => { onOpen(e.id); setQ(""); }}
                className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-[12.5px] hover:bg-accent"
              >
                <span>{e.name}</span>
                <span className="font-mono text-[10.5px] text-faint">{e.type} · {e.domain}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-success" /> Synced 8m ago</span>
        <div className="flex size-6 items-center justify-center rounded-full border bg-surface-2 text-[10.5px] font-medium text-foreground">UA</div>
      </div>
    </header>
  );
}
