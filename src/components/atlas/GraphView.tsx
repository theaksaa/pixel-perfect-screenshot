import { useMemo, useState } from "react";
import { Box, Database, Globe, Network, Radio, Waypoints, Cuboid, ArrowRight, Minus, Plus, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { graphFor, NODE_H, NODE_W, type EdgeKind, type EntityType, type GraphNode } from "@/lib/atlas-data";

export type Filter = "all" | Exclude<EdgeKind, "call">;

const typeIcon: Record<EntityType, typeof Box> = {
  platform: Network,
  gateway: Waypoints,
  service: Box,
  database: Database,
  topic: Radio,
  external: Globe,
  component: Cuboid,
  endpoint: ArrowRight,
};

const typeTone: Record<EntityType, string> = {
  platform: "text-muted-foreground",
  gateway: "text-primary",
  service: "text-primary",
  database: "text-edge-data",
  topic: "text-edge-kafka",
  external: "text-muted-foreground",
  component: "text-faint",
  endpoint: "text-edge-rest",
};

const edgeStroke: Record<EdgeKind, { color: string; dash?: string; width: number }> = {
  rest: { color: "var(--edge-rest)", width: 1.4 },
  kafka: { color: "var(--edge-kafka)", dash: "5 4", width: 1.4 },
  grpc: { color: "var(--edge-grpc)", dash: "1.5 4", width: 1.8 },
  data: { color: "var(--edge-data)", width: 1.4 },
  call: { color: "var(--edge-call)", width: 1.2 },
};

const edgeLabelTone: Record<EdgeKind, string> = {
  rest: "text-edge-rest",
  kafka: "text-edge-kafka",
  grpc: "text-edge-grpc",
  data: "text-edge-data",
  call: "text-faint",
};

const PAD = 70;

function elbow(a: GraphNode, b: GraphNode) {
  const x1 = a.x, y1 = a.y + NODE_H / 2;
  const x2 = b.x, y2 = b.y - NODE_H / 2 - 3;
  const mid = (y1 + y2) / 2;
  if (Math.abs(x1 - x2) < 1) return { d: `M${x1},${y1} V${y2}`, lx: x2, ly: mid };
  const r = Math.min(10, Math.abs(x2 - x1) / 2);
  const s = x2 > x1 ? 1 : -1;
  const d = `M${x1},${y1} V${mid - r} Q${x1},${mid} ${x1 + s * r},${mid} H${x2 - s * r} Q${x2},${mid} ${x2},${mid + r} V${y2}`;
  return { d, lx: x2, ly: (mid + y2) / 2 + 2 };
}

interface Props {
  contextId: string;
  contextName: string;
  filter: Filter;
  onFilter: (f: Filter) => void;
  highlight: string[];
  onOpen: (id: string) => void;
}

export function GraphView({ contextId, contextName, filter, onFilter, highlight, onOpen }: Props) {
  const graph = useMemo(() => graphFor(contextId), [contextId]);
  const [zoom, setZoom] = useState(1);
  const [hover, setHover] = useState<string | null>(null);

  const byKey = Object.fromEntries(graph.nodes.map((n) => [n.key, n]));
  const maxX = Math.max(...graph.nodes.map((n) => n.x)) + NODE_W / 2 + PAD;
  const minX = Math.min(...graph.nodes.map((n) => n.x)) - NODE_W / 2 - PAD;
  const maxY = Math.max(...graph.nodes.map((n) => n.y)) + NODE_H / 2 + PAD;
  const width = maxX - minX;
  const height = maxY + 10;

  const edgeVisible = (k: EdgeKind) => filter === "all" || k === filter;
  const hl = new Set(highlight);
  const touched = new Set<string>();
  graph.edges.forEach((e) => {
    if (filter !== "all" && edgeVisible(e.kind)) { touched.add(e.from); touched.add(e.to); }
  });
  const nodeDim = (k: string) => {
    if (hl.size && !hl.has(k)) return true;
    if (filter !== "all" && !touched.has(k)) return true;
    return false;
  };

  const level = contextId === "platform" ? "System graph" : graph.nodes.some((n) => n.type === "component") ? "Service graph" : "Dependency graph";

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex h-11 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-medium">{contextName}</span>
          <span className="text-xs text-faint">{level} · {graph.nodes.length} entities · {graph.edges.length} connections</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-faint">Connections</span>
          <div className="flex rounded-md border bg-background p-0.5">
            {(["all", "rest", "kafka", "grpc", "data"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => onFilter(f)}
                className={cn(
                  "flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs transition-colors",
                  filter === f ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f !== "all" && (
                  <svg width="12" height="2" aria-hidden>
                    <line x1="0" y1="1" x2="12" y2="1" stroke={edgeStroke[f].color} strokeWidth="2" strokeDasharray={f === "kafka" ? "3 2" : f === "grpc" ? "1 2" : undefined} />
                  </svg>
                )}
                {f === "all" ? "All" : f === "rest" ? "REST" : f === "kafka" ? "Kafka" : f === "grpc" ? "gRPC" : "Data"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="canvas-grid scrollbar-thin relative flex-1 overflow-auto">
        <div
          key={contextId}
          className="relative mx-auto my-6 origin-top animate-in fade-in zoom-in-[0.97] duration-300"
          style={{ width, height, transform: `scale(${zoom})` }}
        >
          <svg className="absolute inset-0 overflow-visible" width={width} height={height} viewBox={`${minX} 0 ${width} ${height}`}>
            <defs>
              {(Object.keys(edgeStroke) as EdgeKind[]).map((k) => (
                <marker key={k} id={`arrow-${k}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,1 L9,5 L0,9 z" fill={edgeStroke[k].color} />
                </marker>
              ))}
            </defs>
            {graph.edges.map((e, i) => {
              const a = byKey[e.from], b = byKey[e.to];
              if (!a || !b) return null;
              const { d } = elbow(a, b);
              const st = edgeStroke[e.kind];
              const dim = !edgeVisible(e.kind) || (hl.size > 0 && !(hl.has(e.from) && hl.has(e.to)));
              const hot = hover === e.from || hover === e.to;
              return (
                <path
                  key={i}
                  d={d}
                  fill="none"
                  stroke={st.color}
                  strokeWidth={hot ? st.width + 0.6 : st.width}
                  strokeDasharray={st.dash}
                  strokeLinecap="round"
                  markerEnd={`url(#arrow-${e.kind})`}
                  className="transition-opacity duration-300"
                  opacity={dim ? 0.08 : hot ? 1 : 0.75}
                />
              );
            })}
          </svg>

          {graph.edges.map((e, i) => {
            const a = byKey[e.from], b = byKey[e.to];
            if (!a || !b || !e.label) return null;
            const { lx, ly } = elbow(a, b);
            const dim = !edgeVisible(e.kind) || (hl.size > 0 && !(hl.has(e.from) && hl.has(e.to)));
            return (
              <div
                key={`l${i}`}
                className={cn(
                  "absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-sm border bg-surface px-1.5 py-px font-mono text-[10.5px] transition-opacity duration-300",
                  edgeLabelTone[e.kind],
                  dim && "opacity-10",
                )}
                style={{ left: lx - minX, top: ly }}
              >
                {e.label}
              </div>
            );
          })}

          {graph.nodes.map((nd) => {
            const Icon = typeIcon[nd.type];
            const clickable = !!nd.ref && nd.ref !== contextId;
            const dim = nodeDim(nd.key);
            const lit = hl.has(nd.key);
            return (
              <button
                key={nd.key}
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onOpen(nd.ref!)}
                onMouseEnter={() => setHover(nd.key)}
                onMouseLeave={() => setHover(null)}
                className={cn(
                  "group absolute flex flex-col justify-center gap-0.5 border bg-card px-3 text-left transition-all duration-300",
                  nd.type === "database" ? "rounded-xl" : nd.type === "topic" || nd.type === "endpoint" ? "rounded-full px-4" : "rounded-md",
                  nd.type === "external" && "border-dashed",
                  nd.type === "component" && "bg-surface-2",
                  clickable ? "cursor-pointer hover:border-border-strong hover:bg-accent" : "cursor-default",
                  lit && "border-primary/70 ring-1 ring-primary/30",
                  dim && "opacity-25",
                )}
                style={{ left: nd.x - minX - NODE_W / 2, top: nd.y - NODE_H / 2, width: NODE_W, height: NODE_H }}
              >
                <div className="flex items-center gap-1.5">
                  <Icon className={cn("size-3.5 shrink-0", typeTone[nd.type])} strokeWidth={1.75} />
                  <span className={cn("truncate text-[12.5px] font-medium", nd.mono && "font-mono text-[11.5px]")}>{nd.label}</span>
                  {clickable && <ArrowRight className="ml-auto size-3 shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100" />}
                </div>
                {nd.sub && <span className="truncate pl-5 text-[11px] text-muted-foreground">{nd.sub}</span>}
                {nd.stats && <span className="truncate pl-5 font-mono text-[10.5px] text-faint">{nd.stats}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-end justify-between">
        <div className="pointer-events-auto flex items-center gap-3 rounded-md border bg-background/90 px-3 py-1.5 text-[11px] text-muted-foreground backdrop-blur">
          {(["rest", "kafka", "grpc", "data", "call"] as EdgeKind[]).map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <svg width="16" height="2" aria-hidden><line x1="0" y1="1" x2="16" y2="1" stroke={edgeStroke[k].color} strokeWidth="2" strokeDasharray={k === "kafka" ? "4 3" : k === "grpc" ? "1 3" : undefined} /></svg>
              {k === "rest" ? "REST" : k === "kafka" ? "Kafka" : k === "grpc" ? "gRPC" : k === "data" ? "SQL" : "In-process"}
            </span>
          ))}
        </div>
        <div className="pointer-events-auto flex items-center rounded-md border bg-background/90 text-muted-foreground backdrop-blur">
          <button className="p-1.5 hover:text-foreground" onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))} aria-label="Zoom out"><Minus className="size-3.5" /></button>
          <span className="w-10 text-center font-mono text-[11px]">{Math.round(zoom * 100)}%</span>
          <button className="p-1.5 hover:text-foreground" onClick={() => setZoom((z) => Math.min(1.4, z + 0.1))} aria-label="Zoom in"><Plus className="size-3.5" /></button>
          <button className="border-l p-1.5 hover:text-foreground" onClick={() => setZoom(1)} aria-label="Reset zoom"><Maximize2 className="size-3.5" /></button>
        </div>
      </div>
    </div>
  );
}
