import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GraphView } from "@/components/atlas/GraphView";
import { buildModel } from "@/lib/atlas-data";

const model = buildModel({
  project: { id: "p", name: "Project" },
  nodes: [{ id: "service", name: "Test Service", type: "service" }],
  relationships: [],
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function renderGraph() {
  const onOpen = vi.fn();
  render(
    <GraphView
      model={model}
      kind="architecture"
      onKind={() => {}}
      contextId="p"
      contextName="Project"
      filter="all"
      onFilter={() => {}}
      highlight={[]}
      onOpen={onOpen}
    />,
  );
  const canvas = screen.getByLabelText("Graph canvas");
  Object.defineProperties(canvas, { clientWidth: { value: 800 }, clientHeight: { value: 600 } });
  const camera = () => {
    const transform = (canvas.querySelector(":scope > div") as HTMLElement).style.transform;
    const [x, y, zoom] = transform.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g)!.map(Number);
    return { x: x!, y: y!, zoom: zoom! };
  };
  return { canvas, camera, onOpen };
}
describe("graph mouse navigation", () => {
  it("zooms toward the wheel cursor, prevents page scrolling and clamps zoom", () => {
    const { canvas, camera } = renderGraph();
    const before = camera();
    const wheel = new WheelEvent("wheel", {
      deltaY: -100,
      clientX: 200,
      clientY: 150,
      bubbles: true,
      cancelable: true,
    });
    fireEvent(canvas, wheel);
    const after = camera();
    expect(wheel.defaultPrevented).toBe(true);
    expect(after.zoom).toBeGreaterThan(before.zoom);
    expect((200 - after.x) / after.zoom).toBeCloseTo((200 - before.x) / before.zoom);
    expect((150 - after.y) / after.zoom).toBeCloseTo((150 - before.y) / before.zoom);
    for (let i = 0; i < 15; i++)
      fireEvent.wheel(canvas, { deltaY: -200, clientX: 200, clientY: 150 });
    expect(camera().zoom).toBe(3);
    for (let i = 0; i < 25; i++)
      fireEvent.wheel(canvas, { deltaY: 200, clientX: 200, clientY: 150 });
    expect(camera().zoom).toBe(0.2);
  });
  it("pans with middle drag, releases capture and keeps left node clicks working", () => {
    vi.stubGlobal(
      "PointerEvent",
      class extends MouseEvent {
        pointerId: number;
        constructor(type: string, init: PointerEventInit) {
          super(type, init);
          this.pointerId = init.pointerId ?? 0;
        }
      },
    );
    const { canvas, camera, onOpen } = renderGraph();
    canvas.setPointerCapture = vi.fn();
    canvas.hasPointerCapture = () => true;
    canvas.releasePointerCapture = vi.fn();
    const before = camera();
    fireEvent.pointerDown(canvas, {
      button: 1,
      buttons: 4,
      pointerId: 1,
      clientX: 200,
      clientY: 150,
    });
    fireEvent.pointerMove(canvas, { buttons: 4, pointerId: 1, clientX: 280, clientY: 110 });
    expect(camera()).toEqual({ ...before, x: before.x + 80, y: before.y - 40 });
    fireEvent.pointerUp(canvas, { button: 1, buttons: 0, pointerId: 1 });
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(1);
    fireEvent.pointerMove(canvas, { buttons: 0, pointerId: 1, clientX: 400, clientY: 400 });
    expect(camera().x).toBe(before.x + 80);
    fireEvent.click(screen.getByRole("button", { name: /Test Service/ }));
    expect(onOpen).toHaveBeenCalledWith("service");
  });
});
