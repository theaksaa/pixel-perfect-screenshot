export type EntityType =
  | "platform"
  | "gateway"
  | "service"
  | "database"
  | "topic"
  | "external"
  | "component"
  | "endpoint";

export type EdgeKind = "rest" | "kafka" | "grpc" | "data" | "call";

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  domain?: string;
  stack?: string;
  stats?: string | undefined;
  repo?: string;
}

export interface GraphNode {
  key: string;
  label: string;
  type: EntityType;
  x: number;
  y: number;
  sub?: string | undefined;
  stats?: string | undefined;
  ref?: string | undefined; // entity id to drill into
  mono?: boolean;
}

export interface GraphEdge {
  from: string;
  to: string;
  kind: EdgeKind;
  label?: string;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const PLATFORM_ID = "platform";

export const entities: { [k: string]: Entity } = {
  platform: { id: "platform", name: "Acme Platform", type: "platform" },
  gateway: { id: "gateway", name: "API Gateway", type: "gateway", domain: "Edge", stack: "Envoy · Lua", stats: "38 routes", repo: "acme/edge-gateway" },
  order: { id: "order", name: "Order Service", type: "service", domain: "Commerce", stack: "Java · Spring Boot", stats: "12 APIs · 4 Events", repo: "acme/order-service" },
  catalog: { id: "catalog", name: "Catalog Service", type: "service", domain: "Commerce", stack: "Go · Fiber", stats: "9 APIs · 2 Events", repo: "acme/catalog" },
  payment: { id: "payment", name: "Payment Service", type: "service", domain: "Payments", stack: "Kotlin · Ktor", stats: "7 APIs · 3 Events", repo: "acme/payments" },
  inventory: { id: "inventory", name: "Inventory Service", type: "service", domain: "Commerce", stack: "Go · gRPC", stats: "6 RPCs · 2 Events", repo: "acme/inventory" },
  eventbus: { id: "eventbus", name: "Kafka", type: "topic", domain: "Infrastructure", stack: "Confluent · 3 brokers", stats: "24 topics", repo: "acme/kafka-config" },
  ordersdb: { id: "ordersdb", name: "Orders DB", type: "database", domain: "Commerce", stack: "PostgreSQL 15", stats: "14 tables", repo: "acme/order-service" },
  notification: { id: "notification", name: "Notification Service", type: "service", domain: "Engagement", stack: "Node · NestJS", stats: "3 APIs · 5 Events", repo: "acme/notifications" },
  analytics: { id: "analytics", name: "Analytics Service", type: "service", domain: "Data", stack: "Python · Flink", stats: "11 Events", repo: "acme/analytics-pipeline" },
  stripe: { id: "stripe", name: "Stripe", type: "external", domain: "External", stack: "Third-party API", stats: "api.stripe.com" },
};

const W = 200;
const H = 68;
export const NODE_W = W;
export const NODE_H = H;

const n = (key: string, x: number, y: number, extra: Partial<GraphNode> = {}): GraphNode => {
  const e = entities[key];
  return {
    key,
    label: e?.name ?? key,
    type: e?.type ?? "component",
    sub: e?.stack,
    stats: e?.stats,
    ref: e ? key : undefined,
    x,
    y,
    ...extra,
  };
};

const platformGraph: Graph = {
  nodes: [
    n("gateway", 660, 60),
    n("order", 440, 210),
    n("catalog", 880, 210),
    n("payment", 200, 380),
    n("eventbus", 440, 380, { label: "Kafka" }),
    n("ordersdb", 660, 380),
    n("inventory", 880, 380),
    n("stripe", 200, 550),
    n("notification", 380, 550),
    n("analytics", 600, 550),
  ],
  edges: [
    { from: "gateway", to: "order", kind: "rest", label: "REST" },
    { from: "gateway", to: "catalog", kind: "rest", label: "REST" },
    { from: "order", to: "payment", kind: "rest", label: "REST" },
    { from: "order", to: "eventbus", kind: "kafka", label: "Kafka" },
    { from: "order", to: "ordersdb", kind: "data", label: "SQL" },
    { from: "catalog", to: "inventory", kind: "grpc", label: "gRPC" },
    { from: "payment", to: "stripe", kind: "rest", label: "HTTPS" },
    { from: "eventbus", to: "notification", kind: "kafka", label: "Kafka" },
    { from: "eventbus", to: "analytics", kind: "kafka", label: "Kafka" },
  ],
};

const c = (key: string, label: string, x: number, y: number, sub: string, type: EntityType = "component"): GraphNode => ({
  key, label, x, y, sub, type, mono: type === "endpoint" || type === "topic",
});

const orderGraph: Graph = {
  nodes: [
    c("ep", "POST /orders", 480, 50, "HTTP entrypoint", "endpoint"),
    c("ctrl", "OrderController", 480, 170, "web · @RestController"),
    c("app", "OrderApplicationService", 480, 290, "application · @Service"),
    c("pc", "PaymentClient", 200, 420, "infra · Feign client"),
    c("repo", "OrderRepository", 480, 420, "infra · JPA"),
    c("pub", "OrderEventPublisher", 760, 420, "infra · KafkaTemplate"),
    n("payment", 200, 570),
    n("ordersdb", 480, 570),
    c("topic", "order.completed", 760, 570, "Kafka topic · 12 partitions", "topic"),
    n("notification", 640, 720),
    n("analytics", 880, 720),
  ],
  edges: [
    { from: "ep", to: "ctrl", kind: "call" },
    { from: "ctrl", to: "app", kind: "call" },
    { from: "app", to: "pc", kind: "call" },
    { from: "app", to: "repo", kind: "call" },
    { from: "app", to: "pub", kind: "call" },
    { from: "pc", to: "payment", kind: "rest", label: "POST /payments/authorize" },
    { from: "repo", to: "ordersdb", kind: "data", label: "SQL" },
    { from: "pub", to: "topic", kind: "kafka", label: "produces" },
    { from: "topic", to: "notification", kind: "kafka", label: "consumed by" },
    { from: "topic", to: "analytics", kind: "kafka", label: "consumed by" },
  ],
};

const paymentGraph: Graph = {
  nodes: [
    c("ep", "POST /payments/authorize", 480, 50, "HTTP entrypoint", "endpoint"),
    c("ctrl", "PaymentController", 480, 170, "routes · Ktor"),
    c("auth", "AuthorizationService", 480, 290, "domain"),
    c("psp", "StripeGateway", 200, 420, "infra · HTTP client"),
    c("repo", "PaymentRepository", 480, 420, "infra · Exposed"),
    c("pub", "PaymentEventPublisher", 760, 420, "infra · Kafka producer"),
    n("stripe", 200, 570),
    { key: "pdb", label: "Payments DB", type: "database", x: 480, y: 570, sub: "PostgreSQL 15", stats: "6 tables" },
    c("topic", "payment.completed", 760, 570, "Kafka topic · 6 partitions", "topic"),
    n("order", 760, 720),
  ],
  edges: [
    { from: "ep", to: "ctrl", kind: "call" },
    { from: "ctrl", to: "auth", kind: "call" },
    { from: "auth", to: "psp", kind: "call" },
    { from: "auth", to: "repo", kind: "call" },
    { from: "auth", to: "pub", kind: "call" },
    { from: "psp", to: "stripe", kind: "rest", label: "POST /v1/payment_intents" },
    { from: "repo", to: "pdb", kind: "data", label: "SQL" },
    { from: "pub", to: "topic", kind: "kafka", label: "produces" },
    { from: "topic", to: "order", kind: "kafka", label: "consumed by" },
  ],
};

/** Neighborhood graph derived from the system graph for entities without a hand-authored one. */
function neighborhood(id: string): Graph {
  const up = platformGraph.edges.filter((e) => e.to === id);
  const down = platformGraph.edges.filter((e) => e.from === id);
  const row = (ids: string[], y: number) => {
    const gap = 260;
    const start = 480 - ((ids.length - 1) * gap) / 2;
    return ids.map((k, i) => n(k, start + i * gap, y));
  };
  const nodes = [
    ...row(up.map((e) => e.from), 60),
    { ...n(id, 480, up.length ? 230 : 60), ref: undefined },
    ...row(down.map((e) => e.to), up.length ? 400 : 230),
  ];
  return { nodes, edges: [...up, ...down] };
}

export function graphFor(id: string): Graph {
  if (id === PLATFORM_ID) return platformGraph;
  if (id === "order") return orderGraph;
  if (id === "payment") return paymentGraph;
  return neighborhood(id);
}

/* ---------------- Documentation ---------------- */

export interface Doc {
  summary: string; // supports [[id]] and [[id|label]] inline links
  responsibilities: string[];
  dependencies: { id: string; text: string }[];
  apis?: string[];
  produces?: string[];
  consumes?: string[];
  flows?: { name: string; steps: string[] }[];
}

export const docs: Record<string, Doc> = {
  platform: {
    summary:
      "Acme Platform is an event-driven commerce system of 9 services across 5 domains. Traffic enters through the [[gateway]], which routes to [[order]] and [[catalog]]. Asynchronous work fans out over [[eventbus|Kafka]].",
    responsibilities: [
      "Product discovery and catalog management",
      "Order placement and lifecycle",
      "Payment authorization and capture",
      "Customer notifications and analytics",
    ],
    dependencies: [
      { id: "order", text: "Core of the checkout domain. Owns order state." },
      { id: "payment", text: "Authorizes and captures payments via Stripe." },
      { id: "eventbus", text: "Shared event backbone; 24 topics." },
      { id: "stripe", text: "External payment provider." },
    ],
    flows: [
      { name: "Checkout", steps: ["Gateway", "Order Service", "Payment Service", "Orders DB", "order.completed"] },
      { name: "Product browse", steps: ["Gateway", "Catalog Service", "Inventory Service"] },
    ],
  },
  order: {
    summary:
      "Order Service owns the complete order lifecycle. It calls [[payment]] for payment authorization, persists state in [[ordersdb]], and publishes lifecycle events consumed by [[notification]] and [[analytics]].",
    responsibilities: ["Creates and manages orders", "Coordinates payments", "Stores order state", "Publishes lifecycle events"],
    dependencies: [
      { id: "payment", text: "Used for payment authorization through REST." },
      { id: "ordersdb", text: "PostgreSQL database containing order state." },
      { id: "eventbus", text: "Publishes order lifecycle events." },
    ],
    apis: ["POST /orders", "GET /orders/{id}", "POST /orders/{id}/cancel", "GET /orders?customerId={id}"],
    produces: ["order.completed", "order.cancelled"],
    consumes: ["payment.completed"],
    flows: [{ name: "Create Order", steps: ["POST /orders", "validate", "authorize payment", "save", "publish order.completed"] }],
  },
  payment: {
    summary:
      "Payment Service authorizes, captures and refunds payments. It is called synchronously by [[order]] and delegates card processing to [[stripe]].",
    responsibilities: ["Authorizes payments", "Captures and refunds", "Stores payment ledger", "Emits payment events"],
    dependencies: [
      { id: "stripe", text: "Payment intents and card processing over HTTPS." },
      { id: "eventbus", text: "Publishes payment.completed and payment.failed." },
    ],
    apis: ["POST /payments/authorize", "POST /payments/{id}/capture", "POST /payments/{id}/refund"],
    produces: ["payment.completed", "payment.failed"],
    consumes: ["order.cancelled"],
    flows: [{ name: "Authorize", steps: ["POST /payments/authorize", "risk check", "Stripe intent", "persist", "publish payment.completed"] }],
  },
};

export function docFor(id: string): Doc {
  if (docs[id]) return docs[id];
  const e = entities[id]!;
  const up = platformGraph.edges.filter((x) => x.to === id);
  const down = platformGraph.edges.filter((x) => x.from === id);
  return {
    summary: `${e.name} is part of the ${e.domain} domain${up.length ? `. It is used by ${up.map((u) => `[[${u.from}]]`).join(" and ")}` : ""}.`,
    responsibilities: [`Owns ${e.domain?.toLowerCase()} capabilities`, `Runs on ${e.stack}`],
    dependencies: down.map((d) => ({ id: d.to, text: `Communicates over ${d.label}.` })),
  };
}

export function pathFor(id: string): { label: string; id?: string }[] {
  const root = { label: "Acme Platform", id: PLATFORM_ID };
  if (id === PLATFORM_ID) return [root];
  const e = entities[id]!;
  return [root, { label: e.domain ?? "" , id: PLATFORM_ID }, { label: e.name, id }];
}

export const suggestions: Record<string, string[]> = {
  platform: ["Explain this architecture", "How does checkout work?", "Show Kafka dependencies", "Which services depend on Order Service?"],
};
export const defaultSuggestions = [
  "Explain this service",
  "What depends on this?",
  "Show Kafka dependencies",
  "How does creating an order work?",
  "What happens if this service goes down?",
];

export function fakeAnswer(q: string, ctx: string): { text: string; highlight: string[] } {
  const name = entities[ctx]!.name;
  const ql = q.toLowerCase();
  if (ql.includes("order") && (ql.includes("creat") || ql.includes("checkout")))
    return {
      text:
        ctx === "order"
          ? "The request enters through `POST /orders` and is handled by `OrderController`.\n\n`OrderApplicationService` then coordinates payment authorization via `PaymentClient`, saves the order through `OrderRepository`, and publishes `order.completed`."
          : "Checkout enters through the API Gateway and hits `POST /orders` on Order Service. Order Service authorizes the payment with Payment Service over REST, writes to Orders DB, then emits `order.completed` to Kafka for Notification and Analytics.",
      highlight: ctx === "order" ? ["ep", "ctrl", "app", "pc", "repo", "pub", "topic"] : ["gateway", "order", "payment", "ordersdb", "eventbus"],
    };
  if (ql.includes("kafka"))
    return {
      text: `In ${name}, event traffic flows through Kafka. Producers publish lifecycle events like \`order.completed\`; Notification Service and Analytics Service consume them independently.`,
      highlight: ["eventbus", "notification", "analytics", "pub", "topic", "order"],
    };
  if (ql.includes("depend"))
    return {
      text: `API Gateway calls Order Service synchronously. Notification and Analytics depend on it indirectly through \`order.completed\`. A breaking change to that event schema affects 2 consumers.`,
      highlight: ["gateway", "order", "notification", "analytics", "topic"],
    };
  if (ql.includes("down"))
    return {
      text: `If ${name} is unavailable, synchronous callers receive 503s from the gateway after a 2s timeout. Event consumers keep working off their committed offsets and catch up on recovery.`,
      highlight: [ctx],
    };
  return {
    text: `${name}: ${docFor(ctx).summary.replace(/\[\[(\w+)(\|([^\]]+))?\]\]/g, (_, id, __, l) => l ?? entities[id]?.name ?? id)}`,
    highlight: [ctx],
  };
}
