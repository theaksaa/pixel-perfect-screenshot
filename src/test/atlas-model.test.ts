import { describe, expect, it } from "vitest";
import {
  buildModel,
  parseProject,
  graphFor,
  pathFor,
  modelAnswer,
  resolveEntity,
  CODE_H,
  NODE_W,
} from "@/lib/atlas-data";
import example from "@/lib/example-project.json";
import { layered } from "@/lib/layout";

const fixture = {
  project: { id: "shop", name: "A different system" },
  nodes: [
    { id: "svc", name: "Custom Service", type: "service" },
    { id: "api", name: "POST /start", type: "endpoint", parent: "svc" },
    { id: "class", name: "Worker", type: "class", parent: "svc" },
    { id: "run", name: "run", type: "method", parent: "class" },
    { id: "helper", name: "helper", type: "function", parent: "svc" },
    { id: "other", name: "Other Service", type: "service" },
    { id: "isolated", name: "Unrelated", type: "method", parent: "other" },
  ],
  relationships: [
    { source: "svc", target: "other", type: "REST" },
    { source: "api", target: "run", type: "CALLS" },
    { source: "run", target: "helper", type: "CALLS" },
    { source: "helper", target: "run", type: "USES" },
  ],
  documentation: { run: "# run\nCalls [[helper]]." },
};
describe("JSON project model", () => {
  it("loads an arbitrary system without demo names or inferred relationships", () => {
    const m = buildModel(fixture);
    expect(graphFor(m, m.root, "architecture").nodes.map((n) => n.key)).toEqual(["svc", "other"]);
    expect(graphFor(m, m.root, "architecture").edges).toHaveLength(1);
    expect(graphFor(m, "run", "code").nodes.map((n) => n.key)).toEqual(
      expect.arrayContaining(["api", "run", "helper"]),
    );
    expect(graphFor(m, "run", "code").nodes.map((n) => n.key)).not.toContain("isolated");
    expect(graphFor(m, "run", "code").edges).toHaveLength(3);
    expect(pathFor(m, "run").map((n) => n.name)).toEqual([
      "A different system",
      "Custom Service",
      "Worker",
      "run",
    ]);
    expect(resolveEntity(m, "Worker.run()")?.id).toBe("run");
    expect(modelAnswer(m, "What does this call?", "run", "code").text).toContain("helper");
    expect(modelAnswer(m, "Explain this context", "shop", "architecture").text).not.toContain(
      "Acme",
    );
  });
  it.each([
    ["{", "Invalid JSON"],
    [JSON.stringify({ project: { id: "p" } }), "Missing project.name"],
    [
      JSON.stringify({ ...fixture, nodes: [...fixture.nodes, fixture.nodes[0]] }),
      "Duplicate node id",
    ],
    [
      JSON.stringify({
        ...fixture,
        nodes: [{ id: "x", name: "X", type: "method", parent: "missing" }],
      }),
      "Unknown parent",
    ],
    [
      JSON.stringify({
        ...fixture,
        nodes: [
          { id: "x", name: "X", type: "method", parent: "y" },
          { id: "y", name: "Y", type: "method", parent: "x" },
        ],
        relationships: [],
        documentation: {},
      }),
      "Parent cycle",
    ],
    [
      JSON.stringify({
        ...fixture,
        relationships: [{ source: "run", target: "missing", type: "CALLS" }],
      }),
      "Unknown relationship target",
    ],
    [JSON.stringify({ ...fixture, documentation: { run: 5 } }), "Invalid documentation.run"],
  ])("rejects malformed input: %s", (input, message) =>
    expect(() => parseProject(input)).toThrow(message),
  );
  it("handles empty graphs and arbitrary entity/relationship types", () => {
    const m = buildModel({ project: { id: "empty", name: "Empty" }, nodes: [], relationships: [] });
    expect(graphFor(m, m.root, "code")).toEqual({ nodes: [], edges: [] });
    const custom = buildModel({
      project: { id: "p", name: "Custom" },
      nodes: [
        { id: "a", name: "A", type: "custom" },
        { id: "b", name: "B", type: "custom" },
      ],
      relationships: [{ source: "a", target: "b", type: "CUSTOM_REL" }],
    });
    expect(graphFor(custom, "p", "code").edges[0]?.label).toBe("CUSTOM_REL");
  });
  it("preserves the original architecture layout in the example", () => {
    const m = buildModel(example);
    const g = graphFor(m, m.root, "architecture");
    expect(g.nodes).toHaveLength(10);
    expect(g.edges).toHaveLength(9);
    expect(g.nodes.find((n) => n.key === "order")).toMatchObject({ x: 440, y: 210 });
    expect(g.nodes.find((n) => n.key === "eventbus")).toMatchObject({ x: 440, y: 380 });
    const code = graphFor(m, "process-order", "code");
    expect(code.nodes.map((n) => n.key)).toEqual(
      expect.arrayContaining([
        "create-order",
        "process-order",
        "save-order",
        "authorize-payment",
        "publish-order",
      ]),
    );
    expect(code.edges.every((e) => e.route && !/NaN|Infinity/.test(e.route.d))).toBe(true);
  });
});
describe("layered graph routing", () => {
  it("routes long edges around intermediate nodes, and preserves cycle direction", () => {
    const result = layered(
      ["a", "b", "c", "d"].map((key) => ({ key, w: NODE_W, h: CODE_H })),
      [
        { from: "a", to: "b" },
        { from: "b", to: "c" },
        { from: "c", to: "d" },
        { from: "a", to: "d" },
        { from: "d", to: "a" },
      ],
      { gapX: 65, gapY: 85, frac: () => 0.5 },
    );
    expect(result.routes.filter(Boolean)).toHaveLength(5);
    expect(result.routes[4]?.reversed).toBe(true);
    // A skip-layer edge has a dedicated corridor on every intermediate layer.
    const longRoute = result.routes[3]!;
    for (const match of longRoute.d.matchAll(/M(-?[\d.]+),(-?[\d.]+)/g)) {
      const x = Number(match[1]),
        y = Number(match[2]);
      for (const id of ["b", "c"]) {
        const n = result.pos[id]!;
        expect(Math.abs(y - n.y) < CODE_H / 2 && Math.abs(x - n.x) < NODE_W / 2).toBe(false);
      }
    }
  });
});
