import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { parseProject, type Model } from "@/lib/atlas-data";
import example from "@/lib/example-project.json";
export function ImportDialog({
  open,
  onClose,
  onLoad,
}: {
  open: boolean;
  onClose: () => void;
  onLoad: (model: Model) => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"paste" | "upload">("paste");
  const [reading, setReading] = useState(false);
  function load(source: string) {
    try {
      const model = parseProject(source);
      onLoad(model);
      setError("");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import project JSON</DialogTitle>
          <DialogDescription>
            Load a project locally. Graphs, documentation, search, and assistant context use the
            same model.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          {(["upload", "paste"] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setError("");
              }}
              className={`rounded-md border px-3 py-1.5 text-xs ${tab === t ? "bg-accent" : "text-muted-foreground"}`}
            >
              {t === "upload" ? "Upload .json file" : "Paste JSON"}
            </button>
          ))}
        </div>
        {tab === "upload" && (
          <input
            aria-label="Upload JSON file"
            type="file"
            accept=".json,application/json"
            disabled={reading}
            className="rounded-md border p-3 text-sm"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setError("");
              setText("");
              setReading(true);
              try {
                setText(await file.text());
              } catch {
                setError("Could not read this file");
              } finally {
                setReading(false);
              }
            }}
          />
        )}
        <textarea
          aria-label="Project JSON"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError("");
          }}
          rows={15}
          spellCheck={false}
          placeholder={
            '{ "project": { "id": "my-project", "name": "My Project" }, "nodes": [], "relationships": [] }'
          }
          className="w-full resize-y rounded-md border bg-background p-3 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter className="flex-wrap">
          <button
            className="mr-auto text-xs text-muted-foreground underline"
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(example, null, 2)], { type: "application/json" }),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = "code-atlas-example.json";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            Download example JSON
          </button>
          <button onClick={onClose} className="rounded-md border px-3 py-2 text-xs">
            Cancel
          </button>
          <button
            onClick={() => load(JSON.stringify(example))}
            className="rounded-md border px-3 py-2 text-xs"
          >
            Load Example
          </button>
          <button
            disabled={!text.trim() || reading}
            onClick={() => load(text)}
            className="rounded-md bg-primary px-3 py-2 text-xs text-primary-foreground disabled:opacity-40"
          >
            Load Project
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
