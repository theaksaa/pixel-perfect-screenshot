import { layered, routeChain, type RoutedEdge } from "./layout";

export type EntityType = string;
export type EdgeKind = "rest" | "kafka" | "grpc" | "data" | "call" | "inheritance" | "dependency";
export type GraphKind = "architecture" | "code";
export interface Entity {
  id: string;
  name: string;
  type: string;
  parent?: string;
  description?: string;
  domain?: string;
  stack?: string;
  stats?: string;
  repo?: string;
  file?: string;
  position?: { x: number; y: number };
}
export interface Relationship {
  source: string;
  target: string;
  type: string;
  label?: string;
  view?: GraphKind;
}
export interface ProjectJSON {
  project: { id: string; name: string; description?: string; repo?: string };
  nodes: Entity[];
  relationships: Relationship[];
  documentation?: Record<string, string>;
}
export interface Model {
  data: ProjectJSON;
  root: string;
  entities: Record<string, Entity>;
  relationships: Relationship[];
  documentation: Record<string, string>;
}
export interface GraphNode {
  key: string;
  label: string;
  type: string;
  x: number;
  y: number;
  sub?: string | undefined;
  stats?: string | undefined;
  ref: string;
  mono?: boolean;
}
export interface GraphEdge {
  from: string;
  to: string;
  kind: EdgeKind;
  label: string;
  route?: RoutedEdge;
}
export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
export const NODE_W = 200;
export const NODE_H = 68;
export const CODE_H = 52;
const archTypes = new Set([
  "gateway",
  "service",
  "database",
  "topic",
  "kafka-topic",
  "broker",
  "external",
]);
export const isArchitecture = (e: Entity) => archTypes.has(e.type.toLowerCase());
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const string = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

export function parseProject(text: string): Model {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON");
  }
  return buildModel(data);
}
export function buildModel(value: unknown): Model {
  if (!object(value) || !object(value["project"])) throw new Error("Missing project.name");
  const p = value["project"];
  for (const k of ["name", "id"]) if (!string(p[k])) throw new Error(`Missing project.${k}`);
  if (!Array.isArray(value["nodes"])) throw new Error("Missing nodes array");
  if (!Array.isArray(value["relationships"])) throw new Error("Missing relationships array");
  const entities: Record<string, Entity> = Object.create(null);
  const root = p["id"] as string;
  entities[root] = {
    id: root,
    name: p["name"] as string,
    type: "platform",
    ...(typeof p["description"] === "string" ? { description: p["description"] } : {}),
    ...(typeof p["repo"] === "string" ? { repo: p["repo"] } : {}),
  };
  for (const [i, n] of value["nodes"].entries()) {
    if (!object(n)) throw new Error(`Invalid nodes[${i}]`);
    for (const key of ["id", "name", "type"])
      if (!string(n[key])) throw new Error(`Missing nodes[${i}].${key}`);
    if (n["parent"] !== undefined && !string(n["parent"]))
      throw new Error(`Invalid nodes[${i}].parent`);
    const id = n["id"] as string;
    if (entities[id]) throw new Error(`Duplicate node id: ${id}`);
    for (const key of ["parent", "description", "domain", "stack", "stats", "repo", "file"])
      if (n[key] !== undefined && typeof n[key] !== "string")
        throw new Error(`Invalid nodes[${i}].${key}`);
    if (
      n["position"] !== undefined &&
      (!object(n["position"]) ||
        !Number.isFinite(n["position"]["x"]) ||
        !Number.isFinite(n["position"]["y"]))
    )
      throw new Error(`Invalid nodes[${i}].position`);
    entities[id] = { ...n, parent: n["parent"] ?? root } as unknown as Entity;
  }
  for (const n of Object.values(entities)) {
    if (n.parent && !entities[n.parent]) throw new Error(`Unknown parent: ${n.parent}`);
    const seen = new Set<string>([n.id]);
    let parent = n.parent;
    while (parent) {
      if (seen.has(parent)) throw new Error(`Parent cycle: ${n.id}`);
      seen.add(parent);
      parent = entities[parent]?.parent;
    }
  }
  for (const [i, r] of value["relationships"].entries()) {
    if (!object(r)) throw new Error(`Invalid relationships[${i}]`);
    for (const key of ["source", "target", "type"])
      if (!string(r[key])) throw new Error(`Missing relationships[${i}].${key}`);
    for (const key of ["source", "target"])
      if (!entities[r[key] as string]) throw new Error(`Unknown relationship ${key}: ${r[key]}`);
    if (r["label"] !== undefined && typeof r["label"] !== "string")
      throw new Error(`Invalid relationships[${i}].label`);
    if (r["view"] !== undefined && !["architecture", "code"].includes(r["view"] as string))
      throw new Error(`Invalid relationships[${i}].view`);
  }
  const docs = value["documentation"];
  if (docs !== undefined && !object(docs)) throw new Error("Invalid documentation");
  if (object(docs))
    for (const [id, text] of Object.entries(docs)) {
      if (!entities[id]) throw new Error(`Unknown documentation node: ${id}`);
      if (typeof text !== "string") throw new Error(`Invalid documentation.${id}`);
    }
  const data = value as unknown as ProjectJSON;
  return {
    data,
    root,
    entities,
    relationships: data.relationships,
    documentation: (docs as Record<string, string>) ?? {},
  };
}
export function pathFor(model: Model, id: string): Entity[] {
  const path: Entity[] = [];
  let current = model.entities[id];
  while (current) {
    path.unshift(current);
    current = current.parent ? model.entities[current.parent] : undefined;
  }
  return path;
}
export function descendants(model: Model, id: string): Set<string> {
  return new Set(
    Object.values(model.entities)
      .filter((n) => pathFor(model, n.id).some((p) => p.id === id))
      .map((n) => n.id),
  );
}
export function displayName(n: Entity): string {
  return ["method", "function", "constructor", "repository-method"].includes(n.type) &&
    !n.name.endsWith(")")
    ? `${n.name}()`
    : n.name;
}
export function edgeKind(type: string): EdgeKind {
  const t = type.toUpperCase().replace(/[- ]/g, "_");
  if (["REST", "HTTP", "HTTP_CALL"].includes(t)) return "rest";
  if (t.includes("GRPC")) return "grpc";
  if (["KAFKA", "PRODUCES", "CONSUMES", "EVENT"].includes(t)) return "kafka";
  if (["SQL", "DATA", "READS", "WRITES"].includes(t)) return "data";
  if (["IMPLEMENTS", "EXTENDS"].includes(t)) return "inheritance";
  if (["USES", "DEPENDS_ON", "CREATES"].includes(t)) return "dependency";
  return "call";
}
export function relationshipView(model: Model, r: Relationship): GraphKind {
  return (
    r.view ??
    (isArchitecture(model.entities[r.source]!) &&
    isArchitecture(model.entities[r.target]!) &&
    ["REST", "KAFKA", "GRPC", "SQL", "HTTP", "DATA"].includes(r.type.toUpperCase())
      ? "architecture"
      : "code")
  );
}
export function graphFor(model: Model, id: string, kind: GraphKind): Graph {
  const rels = model.relationships.filter((r) => relationshipView(model, r) === kind);
  const edges: GraphEdge[] = rels.map((r) => ({
    from: r.source,
    to: r.target,
    kind: edgeKind(r.type),
    label: r.label ?? r.type,
  }));
  let selected: Set<string>;
  if (id === model.root)
    selected = new Set(
      Object.values(model.entities)
        .filter(
          (n) =>
            n.id !== model.root &&
            (kind === "code" ||
              (isArchitecture(n) &&
                (n.parent === model.root ||
                  rels.some((r) => r.source === n.id || r.target === n.id)))),
        )
        .map((n) => n.id),
    );
  else {
    selected = kind === "code" ? descendants(model, id) : new Set([id]);
    if (kind === "code" && selected.size === 1) {
      // Traverse callers and callees separately, so shared helpers don't pull in unrelated callers.
      for (const direction of ["up", "down"] as const) {
        let frontier = new Set([id]);
        for (let hop = 0; hop < 2; hop++) {
          const next = new Set<string>();
          edges.forEach((e) => {
            if (frontier.has(direction === "up" ? e.to : e.from)) {
              const key = direction === "up" ? e.from : e.to;
              selected.add(key);
              next.add(key);
            }
          });
          frontier = next;
        }
      }
    } else {
      const original = new Set(selected);
      edges.forEach((e) => {
        if (original.has(e.from) || original.has(e.to)) {
          selected.add(e.from);
          selected.add(e.to);
        }
      });
    }
    if (kind === "architecture" && !isArchitecture(model.entities[id]!)) {
      const owner = pathFor(model, id).reverse().find(isArchitecture);
      if (owner) return graphFor(model, owner.id, kind);
    }
  }
  selected.delete(model.root);
  const shownEdges = edges.filter((e) => selected.has(e.from) && selected.has(e.to));
  const h = kind === "code" ? CODE_H : NODE_H;
  const layout = layered(
    [...selected].map((key) => ({ key, w: NODE_W, h })),
    shownEdges,
    { gapX: 65, gapY: 85, frac: () => 0.5 },
  );
  const fixed =
    kind === "architecture" &&
    id === model.root &&
    [...selected].every((key) => model.entities[key]!.position);
  const nodes: GraphNode[] = [...selected].map((key) => {
    const n = model.entities[key]!;
    const parent = model.entities[n.parent ?? model.root];
    return {
      key,
      ref: key,
      label: displayName(n),
      type: n.type,
      x: fixed ? n.position!.x : layout.pos[key]!.x,
      y: fixed ? n.position!.y : layout.pos[key]!.y + 70,
      sub:
        (n.file ?? parent?.file)?.split(/[\\/]/).pop() ??
        (kind === "code" ? parent?.name : n.stack),
      stats:
        kind === "architecture"
          ? (n.stats ??
            `${descendants(model, key).size - 1} contained · ${model.relationships.filter((r) => r.source === key || r.target === key).length} links`)
          : undefined,
      mono: kind === "code",
    };
  });
  const byId = Object.fromEntries(nodes.map((n) => [n.key, n]));
  shownEdges.forEach((e, i) => {
    const a = byId[e.from]!,
      b = byId[e.to]!;
    if (e.from === e.to) {
      e.route = {
        d: `M${a.x + NODE_W / 2},${a.y - 10} h25 v45 h-125 v-6`,
        lx: a.x + NODE_W / 2 + 40,
        ly: a.y + 20,
        reversed: false,
      };
    } else if (fixed)
      e.route = {
        ...routeChain([
          { ...a, h },
          { ...b, h },
        ]),
        reversed: false,
      };
    else if (layout.routes[i]) {
      // Translate routes together with node coordinates.
      const shifted = layeredRouteOffset(layout.routes[i]!, 70);
      e.route = shifted;
    }
  });
  return { nodes, edges: shownEdges };
}
function layeredRouteOffset(r: RoutedEdge, dy: number): RoutedEdge {
  // Paths use only absolute M/Q/H/V commands; shift each y coordinate.
  const d = r.d.replace(/([MQHV])([^MQHV]+)/g, (_, cmd: string, coords: string) => {
    const nums = coords.trim().split(/[ ,]+/).map(Number);
    return (
      cmd +
      nums
        .map((v: number, i: number) =>
          cmd === "V" || ((cmd === "M" || cmd === "Q") && i % 2 === 1) ? v + dy : v,
        )
        .join(" ")
    );
  });
  return { ...r, d, ly: r.ly + dy };
}
export function resolveEntity(model: Model, text: string): Entity | undefined {
  return (
    model.entities[text] ??
    Object.values(model.entities).find(
      (n) =>
        n.name === text ||
        displayName(n) === text ||
        `${model.entities[n.parent ?? ""]?.name}.${displayName(n)}` === text,
    )
  );
}
export function modelAnswer(
  model: Model,
  q: string,
  ctx: string,
  kind: GraphKind,
): { text: string; highlight: string[] } {
  const graph = graphFor(model, ctx, kind);
  const question = q.toLowerCase();
  const named = Object.values(model.entities)
    .filter((n) => question.includes(n.name.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length)[0];
  const focus = named?.id ?? ctx;
  let rels = model.relationships.filter(
    (r) =>
      relationshipView(model, r) === kind &&
      (ctx === model.root || graph.nodes.some((n) => n.key === r.source || n.key === r.target)),
  );
  if (/event|kafka/.test(question)) rels = rels.filter((r) => edgeKind(r.type) === "kafka");
  else if (/depend|caller|calls it/.test(question)) rels = rels.filter((r) => r.target === focus);
  else if (/call|flow|execute/.test(question))
    rels = rels.filter(
      (r) => r.source === focus || (focus === model.root && edgeKind(r.type) === "call"),
    );
  else rels = rels.filter((r) => r.source === focus || r.target === focus || focus === model.root);
  const facts = rels
    .slice(0, 12)
    .map(
      (r) =>
        `${displayName(model.entities[r.source]!)} — ${r.type} → ${displayName(model.entities[r.target]!)}`,
    );
  return {
    text: `${model.entities[focus]!.name}: ${model.entities[focus]!.description ?? "Relationships from the loaded JSON."}\n\n${facts.length ? facts.join("\n") : "No matching relationships are declared in this view."}${/down|fail/.test(question) ? "\n\nThe JSON does not specify runtime failure or timeout behavior." : ""}`,
    highlight: [...new Set([focus, ...rels.flatMap((r) => [r.source, r.target])])],
  };
}
