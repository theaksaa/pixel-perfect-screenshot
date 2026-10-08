import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Database,
  Globe,
  Network,
  Radio,
  Waypoints,
  Cuboid,
  ArrowRight,
  Minus,
  Plus,
  Maximize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  graphFor,
  NODE_H,
  NODE_W,
  type EdgeKind,
  type EntityType,
  type GraphNode,
  type Model,
  type GraphKind,
  CODE_H,
} from "@/lib/atlas-data";

export type Filter = "all" | EdgeKind;

const typeIcon: Record<EntityType, typeof Box> = {
  platform: Network,
  gateway: Waypoints,
  service: Box,
  database: Database,
  topic: Radio,
  "kafka-topic": Radio,
  broker: Radio,
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
  "kafka-topic": "text-edge-kafka",
  broker: "text-edge-kafka",
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
  inheritance: { color: "var(--faint)", dash: "4 4", width: 1.2 },
  dependency: { color: "var(--edge-call)", dash: "2 3", width: 1.2 },
};

const edgeLabelTone: Record<EdgeKind, string> = {
  rest: "text-edge-rest",
  kafka: "text-edge-kafka",
  grpc: "text-edge-grpc",
  data: "text-edge-data",
  call: "text-faint",
  inheritance: "text-faint",
  dependency: "text-faint",
};

const PAD = 70;

function elbow(a: GraphNode, b: GraphNode) {
  const x1 = a.x,
    y1 = a.y + NODE_H / 2;
  const x2 = b.x,
    y2 = b.y - NODE_H / 2 - 3;
  const mid = (y1 + y2) / 2;
  if (Math.abs(x1 - x2) < 1) return { d: `M${x1},${y1} V${y2}`, lx: x2, ly: mid };
  const r = Math.min(10, Math.abs(x2 - x1) / 2);
  const s = x2 > x1 ? 1 : -1;
  const d = `M${x1},${y1} V${mid - r} Q${x1},${mid} ${x1 + s * r},${mid} H${x2 - s * r} Q${x2},${mid} ${x2},${mid + r} V${y2}`;
  return { d, lx: x2, ly: (mid + y2) / 2 + 2 };
}

interface Props {
  model: Model;
  kind: GraphKind;
  onKind: (kind: GraphKind) => void;
  contextId: string;
  contextName: string;
  filter: Filter;
  onFilter: (f: Filter) => void;
  highlight: string[];
  onOpen: (id: string) => void;
}

export function GraphView({
  model,
  kind,
  onKind,
  contextId,
  contextName,
  filter,
  onFilter,
  highlight,
  onOpen,
}: Props) {
  const graph = useMemo(() => graphFor(model, contextId, kind), [model, contextId, kind]);
  const nodeHeight = kind === "code" ? CODE_H : NODE_H;
  const [camera, setCamera] = useState({ zoom: 1, x: 0, y: 24 });
  const cameraRef = useRef(camera);
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    originX: number;
    originY: number;
  } | null>(null);
  const [panning, setPanning] = useState(false);
  const { zoom } = camera;
  const updateCamera = useCallback((next: typeof camera) => {
    cameraRef.current = next;
    setCamera(next);
  }, []);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<string | null>(null);

  const byKey = Object.fromEntries(graph.nodes.map((n) => [n.key, n]));
  const maxX =
    (graph.nodes.length ? Math.max(...graph.nodes.map((n) => n.x)) : 0) + NODE_W / 2 + PAD;
  const minX =
    (graph.nodes.length ? Math.min(...graph.nodes.map((n) => n.x)) : 0) - NODE_W / 2 - PAD;
  const maxY = Math.max(0, ...graph.nodes.map((n) => n.y)) + NODE_H / 2 + PAD;
  const width = maxX - minX;
  const height = maxY + 10;
  const fitGraph = useCallback(() => {
    const canvas = canvasRef.current;
    const viewportWidth = canvas?.clientWidth || width;
    const viewportHeight = canvas?.clientHeight || height + 48;
    const nextZoom = Math.min(
      1,
      Math.max(0.2, Math.min((viewportWidth - 32) / width, (viewportHeight - 48) / height)),
    );
    updateCamera({
      zoom: nextZoom,
      x: (viewportWidth - width * nextZoom) / 2,
      y: Math.max(24, (viewportHeight - height * nextZoom) / 2),
    });
  }, [width, height, updateCamera]);
  const zoomAt = useCallback(
    (nextZoom: number, x: number, y: number) => {
      const current = cameraRef.current;
      const clampedZoom = Math.min(3, Math.max(0.2, nextZoom));
      const ratio = clampedZoom / current.zoom;
      updateCamera({
        zoom: clampedZoom,
        x: x - (x - current.x) * ratio,
        y: y - (y - current.y) * ratio,
      });
    },
    [updateCamera],
  );
  const zoomFromCenter = (factor: number) => {
    const canvas = canvasRef.current;
    zoomAt(
      cameraRef.current.zoom * factor,
      (canvas?.clientWidth ?? width) / 2,
      (canvas?.clientHeight ?? height) / 2,
    );
  };
  useEffect(() => {
    if (kind === "code") fitGraph();
    else
      updateCamera({
        zoom: 1,
        x: Math.max(0, ((canvasRef.current?.clientWidth ?? width) - width) / 2),
        y: 24,
      });
  }, [kind, width, fitGraph, updateCamera]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const bounds = canvas.getBoundingClientRect();
      const pixels =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1);
      zoomAt(
        cameraRef.current.zoom * Math.exp(-Math.max(-200, Math.min(200, pixels)) * 0.002),
        event.clientX - bounds.left,
        event.clientY - bounds.top,
      );
    };
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => canvas.removeEventListener("wheel", wheel);
  }, [zoomAt]);
  const endPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setPanning(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const edgeVisible = (k: EdgeKind) => filter === "all" || k === filter;
  const hl = new Set(highlight);
  const touched = new Set<string>();
  graph.edges.forEach((e) => {
    if (filter !== "all" && edgeVisible(e.kind)) {
      touched.add(e.from);
      touched.add(e.to);
    }
  });
  const nodeDim = (k: string) => {
    if (hl.size && !hl.has(k)) return true;
    if (filter !== "all" && !touched.has(k)) return true;
    return false;
  };

  const level = kind === "code" ? "Code graph" : "Architecture graph";
  const filters: Filter[] =
    kind === "code"
      ? ["all", "call", "rest", "kafka", "data", "inheritance", "dependency"]
      : ["all", "rest", "kafka", "grpc", "data"];
  const filterLabel = (f: Filter) =>
    ({
      all: "All",
      call: "Calls",
      rest: kind === "code" ? "HTTP" : "REST",
      kafka: kind === "code" ? "Events" : "Kafka",
      grpc: "gRPC",
      data: "Data",
      inheritance: "Inheritance",
      dependency: "Uses",
    })[f];

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex min-h-11 flex-wrap shrink-0 items-center justify-between gap-2 border-b px-4 py-2">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-medium">{contextName}</span>
          <span className="text-xs text-faint">
            {level} · {graph.nodes.length} entities · {graph.edges.length} connections
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border p-0.5">
            {(["architecture", "code"] as const).map((k) => (
              <button
                key={k}
                onClick={() => onKind(k)}
                className={cn(
                  "rounded-sm px-2 py-0.5 text-xs",
                  kind === k ? "bg-accent text-foreground" : "text-muted-foreground",
                )}
              >
                {k === "code" ? "Code" : "Architecture"}
              </button>
            ))}
          </div>
          <div className="flex rounded-md border bg-background p-0.5">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => onFilter(f)}
                className={cn(
                  "flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs transition-colors",
                  filter === f
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f !== "all" && (
                  <svg width="12" height="2" aria-hidden>
                    <line
                      x1="0"
                      y1="1"
                      x2="12"
                      y2="1"
                      stroke={edgeStroke[f].color}
                      strokeWidth="2"
                      strokeDasharray={f === "kafka" ? "3 2" : f === "grpc" ? "1 2" : undefined}
                    />
                  </svg>
                )}
                {filterLabel(f)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        ref={canvasRef}
        aria-label="Graph canvas"
        className={cn(
          "canvas-grid relative flex-1 overflow-hidden",
          panning && "select-none cursor-grabbing [&_*]:cursor-grabbing",
        )}
        onMouseDown={(event) => {
          if (event.button === 1) event.preventDefault();
        }}
        onAuxClick={(event) => {
          if (event.button === 1) event.preventDefault();
        }}
        onPointerDown={(event) => {
          if (event.button !== 1) return;
          event.preventDefault();
          const current = cameraRef.current;
          dragRef.current = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            originX: current.x,
            originY: current.y,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          setPanning(true);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          if (!(event.buttons & 4)) {
            endPan(event);
            return;
          }
          updateCamera({
            ...cameraRef.current,
            x: drag.originX + event.clientX - drag.x,
            y: drag.originY + event.clientY - drag.y,
          });
        }}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onLostPointerCapture={() => {
          dragRef.current = null;
          setPanning(false);
        }}
      >
        {graph.nodes.length === 0 && (
          <p className="p-12 text-sm text-muted-foreground">
            No entities in this view. Try Code or import a project with architecture nodes.
          </p>
        )}
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width,
            height,
            transform: `translate(${camera.x}px, ${camera.y}px) scale(${zoom})`,
          }}
        >
          <div
            key={contextId}
            className="relative origin-top-left animate-in fade-in duration-300"
            style={{ width, height }}
          >
            <svg
              className="absolute inset-0 overflow-visible"
              width={width}
              height={height}
              viewBox={`${minX} 0 ${width} ${height}`}
            >
              <defs>
                {(Object.keys(edgeStroke) as EdgeKind[]).map((k) => (
                  <marker
                    key={k}
                    id={`arrow-${k}`}
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M0,1 L9,5 L0,9 z" fill={edgeStroke[k].color} />
                  </marker>
                ))}
              </defs>
              {graph.edges.map((e, i) => {
                const a = byKey[e.from],
                  b = byKey[e.to];
                if (!a || !b) return null;
                const { d } = e.route ?? elbow(a, b);
                const st = edgeStroke[e.kind];
                const dim =
                  !edgeVisible(e.kind) || (hl.size > 0 && !(hl.has(e.from) && hl.has(e.to)));
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
                    markerEnd={e.route?.reversed ? undefined : `url(#arrow-${e.kind})`}
                    markerStart={e.route?.reversed ? `url(#arrow-${e.kind})` : undefined}
                    className="transition-opacity duration-300"
                    opacity={dim ? 0.08 : hot ? 1 : 0.75}
                  />
                );
              })}
            </svg>

            {graph.edges.map((e, i) => {
              const a = byKey[e.from],
                b = byKey[e.to];
              if (!a || !b || !e.label) return null;
              const { lx, ly } = e.route ?? elbow(a, b);
              const dim =
                !edgeVisible(e.kind) || (hl.size > 0 && !(hl.has(e.from) && hl.has(e.to)));
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
              const Icon = typeIcon[nd.type] ?? Cuboid;
              const clickable = !!nd.ref && nd.ref !== contextId;
              const dim = nodeDim(nd.key);
              const lit = hl.has(nd.key);
              return (
                <button
                  key={nd.key}
                  title={`${nd.label} · ${nd.type}${nd.sub ? ` · ${nd.sub}` : ""}`}
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && onOpen(nd.ref!)}
                  onMouseEnter={() => setHover(nd.key)}
                  onMouseLeave={() => setHover(null)}
                  className={cn(
                    "group absolute flex flex-col justify-center gap-0.5 border bg-card px-3 text-left transition-all duration-300",
                    nd.type === "database"
                      ? "rounded-xl"
                      : nd.type === "topic" || nd.type === "kafka-topic" || nd.type === "endpoint"
                        ? "rounded-full px-4"
                        : "rounded-md",
                    nd.type === "external" && "border-dashed",
                    nd.type === "component" && "bg-surface-2",
                    clickable
                      ? "cursor-pointer hover:border-border-strong hover:bg-accent"
                      : "cursor-default",
                    (lit || nd.key === contextId) && "border-primary/70 ring-1 ring-primary/30",
                    dim && "opacity-25",
                  )}
                  style={{
                    left: nd.x - minX - NODE_W / 2,
                    top: nd.y - nodeHeight / 2,
                    width: NODE_W,
                    height: nodeHeight,
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    {["method", "function", "class", "interface"].includes(nd.type) ? (
                      <span className="w-3.5 shrink-0 font-mono text-xs text-faint">
                        {{ method: "ƒ", function: "ƒ", class: "C", interface: "I" }[nd.type]}
                      </span>
                    ) : (
                      <Icon
                        className={cn("size-3.5 shrink-0", typeTone[nd.type] ?? "text-faint")}
                        strokeWidth={1.75}
                      />
                    )}
                    <span
                      className={cn(
                        "truncate text-[12.5px] font-medium",
                        nd.mono && "font-mono text-[11.5px]",
                      )}
                    >
                      {nd.label}
                    </span>
                    {clickable && (
                      <ArrowRight className="ml-auto size-3 shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
                    )}
                  </div>
                  {nd.sub && (
                    <span className="truncate pl-5 text-[11px] text-muted-foreground">
                      {nd.sub}
                    </span>
                  )}
                  {nd.stats && (
                    <span className="truncate pl-5 font-mono text-[10.5px] text-faint">
                      {nd.stats}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-end justify-between">
        <div className="pointer-events-auto flex items-center gap-3 rounded-md border bg-background/90 px-3 py-1.5 text-[11px] text-muted-foreground backdrop-blur">
          {filters
            .filter((f): f is EdgeKind => f !== "all")
            .map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <svg width="16" height="2" aria-hidden>
                  <line
                    x1="0"
                    y1="1"
                    x2="16"
                    y2="1"
                    stroke={edgeStroke[k].color}
                    strokeWidth="2"
                    strokeDasharray={k === "kafka" ? "4 3" : k === "grpc" ? "1 3" : undefined}
                  />
                </svg>
                {filterLabel(k)}
              </span>
            ))}
        </div>
        <div
          title="Scroll to zoom · Hold the middle mouse button and drag to pan"
          className="pointer-events-auto flex items-center rounded-md border bg-background/90 text-muted-foreground backdrop-blur"
        >
          <button
            className="p-1.5 hover:text-foreground"
            onClick={() => zoomFromCenter(1 / 1.15)}
            aria-label="Zoom out"
          >
            <Minus className="size-3.5" />
          </button>
          <span className="w-10 text-center font-mono text-[11px]">{Math.round(zoom * 100)}%</span>
          <button
            className="p-1.5 hover:text-foreground"
            onClick={() => zoomFromCenter(1.15)}
            aria-label="Zoom in"
          >
            <Plus className="size-3.5" />
          </button>
          <button
            className="border-l p-1.5 hover:text-foreground"
            onClick={fitGraph}
            aria-label="Fit graph"
          >
            <Maximize2 className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
