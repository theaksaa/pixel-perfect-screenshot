import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Atlas } from "@/routes/index";

const custom = {
  project: { id: "custom", name: "Imported System" },
  nodes: [
    { id: "service-x", name: "Unique Service", type: "service" },
    { id: "method-x", name: "execute", type: "method", parent: "service-x" },
  ],
  relationships: [{ source: "service-x", target: "method-x", type: "CALLS", view: "code" }],
  documentation: { "method-x": "# execute\nImported method documentation." },
};
beforeEach(() => localStorage.clear());
afterEach(cleanup);
describe("project import and navigation", () => {
  it("keeps the current project on invalid input, then replaces every view on valid import", () => {
    render(<Atlas />);
    fireEvent.click(screen.getByRole("button", { name: "Import JSON" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Project JSON" }), {
      target: { value: "{" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Load Project" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid JSON");
    expect(
      screen.getByRole("button", { name: /Project: Acme Platform/, hidden: true }),
    ).toBeInTheDocument();
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Project JSON" }), {
      target: { value: JSON.stringify(custom) },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Load Project" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Project: Imported System/ })).toBeInTheDocument();
    expect(screen.queryByText("Order Service")).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("code-atlas-project")!).project.name).toBe(
      "Imported System",
    );
    fireEvent.click(screen.getByRole("button", { name: "Code" }));
    fireEvent.click(screen.getByRole("button", { name: /execute\(\)/ }));
    fireEvent.click(screen.getByRole("button", { name: "Documentation" }));
    expect(screen.getByText("Imported method documentation.")).toBeInTheDocument();
    expect(screen.getByText("Context:", { exact: false })).toHaveTextContent("execute");
    fireEvent.click(screen.getByRole("button", { name: "Import JSON" }));
    fireEvent.click(screen.getByRole("button", { name: "Load Example" }));
    expect(screen.getByRole("button", { name: /Project: Acme Platform/ })).toBeInTheDocument();
  });
  it("restores a persisted project and safely ignores invalid saved JSON", () => {
    localStorage.setItem("code-atlas-project", JSON.stringify(custom));
    const view = render(<Atlas />);
    expect(screen.getByRole("button", { name: /Project: Imported System/ })).toBeInTheDocument();
    view.unmount();
    localStorage.setItem("code-atlas-project", "bad JSON");
    render(<Atlas />);
    expect(screen.getByRole("button", { name: /Project: Acme Platform/ })).toBeInTheDocument();
  });
  it("loads an uploaded JSON file and resets assistant messages", async () => {
    render(<Atlas />);
    fireEvent.click(screen.getByRole("button", { name: "Explain this context" }));
    expect(screen.getByRole("button", { name: "Show on graph" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Import JSON" }));
    fireEvent.click(screen.getByRole("button", { name: "Upload .json file" }));
    const file = new File([JSON.stringify(custom)], "custom.json", { type: "application/json" });
    Object.defineProperty(file, "text", { value: () => Promise.resolve(JSON.stringify(custom)) });
    fireEvent.change(screen.getByLabelText("Upload JSON file"), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Load Project" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Load Project" }));
    expect(screen.getByRole("button", { name: /Project: Imported System/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show on graph" })).not.toBeInTheDocument();
  });
});
