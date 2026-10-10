import { useEffect, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { SCHEDULES, type Repo } from "@/lib/admin-store";

const input =
  "h-8 w-full rounded-md border bg-surface px-2.5 text-[13px] placeholder:text-faint focus:border-border-strong focus:outline-none";
const btn = "rounded-md border px-3 py-1.5 text-xs hover:bg-accent";
const primary =
  "rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-faint">{hint}</span>}
    </label>
  );
}

export function CreateProjectDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => void;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  useEffect(() => {
    if (open) {
      setName("");
      setDesc("");
    }
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>A project groups the repositories Code Atlas analyzes together.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) onCreate(name.trim(), desc.trim());
          }}
        >
          <Field label="Project name">
            <input autoFocus className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Commerce Platform" />
          </Field>
          <Field label="Description">
            <input className={input} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Distributed commerce system" />
          </Field>
          <DialogFooter>
            <button type="button" className={btn} onClick={onClose}>Cancel</button>
            <button type="submit" className={primary} disabled={!name.trim()}>Create project</button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type RepoInput = Pick<Repo, "name" | "url" | "branch" | "schedule" | "cron">;

export function RepoDialog({
  open,
  repo,
  onClose,
  onSave,
}: {
  open: boolean;
  repo?: Repo | undefined;
  onClose: () => void;
  onSave: (v: RepoInput) => void;
}) {
  const [v, setV] = useState<RepoInput>({ name: "", url: "", branch: "main", schedule: "6h", cron: "0 */6 * * *" });
  const [advanced, setAdvanced] = useState(false);
  useEffect(() => {
    if (!open) return;
    setV(repo ? { name: repo.name, url: repo.url, branch: repo.branch, schedule: repo.schedule, cron: repo.cron } : { name: "", url: "", branch: "main", schedule: "6h", cron: "0 */6 * * *" });
    setAdvanced(repo?.schedule === "custom");
  }, [open, repo]);
  const upd = (p: Partial<RepoInput>) => setV((o) => ({ ...o, ...p }));
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{repo ? `Edit ${repo.name}` : "Add repository"}</DialogTitle>
          <DialogDescription>Code Atlas re-analyzes the repository on this schedule to update graphs and docs.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (v.name.trim() && v.url.trim()) onSave({ ...v, name: v.name.trim(), url: v.url.trim() });
          }}
        >
          <Field label="Repository URL">
            <input
              autoFocus
              className={`${input} font-mono text-[12px]`}
              value={v.url}
              placeholder="https://github.com/acme/order-service"
              onChange={(e) => {
                const url = e.target.value;
                const guess = url.split("/").filter(Boolean).pop()?.replace(/\.git$/, "") ?? "";
                upd({ url, ...(!repo && (v.name === "" || v.url.endsWith(v.name)) ? { name: guess } : {}) });
              }}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name">
              <input className={input} value={v.name} onChange={(e) => upd({ name: e.target.value })} placeholder="order-service" />
            </Field>
            <Field label="Branch">
              <input className={`${input} font-mono text-[12px]`} value={v.branch} onChange={(e) => upd({ branch: e.target.value })} />
            </Field>
          </div>
          <Field label="Update schedule">
            <select
              className={input}
              value={advanced ? "custom" : v.schedule}
              onChange={(e) => {
                if (e.target.value === "custom") {
                  setAdvanced(true);
                  upd({ schedule: "custom" });
                } else {
                  setAdvanced(false);
                  const s = SCHEDULES.find((x) => x.id === e.target.value)!;
                  upd({ schedule: s.id, cron: s.cron });
                }
              }}
            >
              {SCHEDULES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
              <option value="custom">Custom (cron)…</option>
            </select>
          </Field>
          <div>
            <button type="button" onClick={() => setAdvanced((a) => !a)} className="text-[11px] text-faint hover:text-muted-foreground">
              {advanced ? "▾" : "▸"} Advanced
            </button>
            {advanced && (
              <div className="mt-2">
                <Field label="Cron expression" hint="minute hour day month weekday — e.g. 0 */6 * * *">
                  <input
                    className={`${input} font-mono text-[12px]`}
                    value={v.cron}
                    onChange={(e) => upd({ cron: e.target.value, schedule: SCHEDULES.find((s) => s.cron && s.cron === e.target.value.trim())?.id ?? "custom" })}
                  />
                </Field>
              </div>
            )}
          </div>
          <DialogFooter>
            <button type="button" className={btn} onClick={onClose}>Cancel</button>
            <button type="submit" className={primary} disabled={!v.name.trim() || !v.url.trim()}>
              {repo ? "Save changes" : "Add repository"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  action,
  danger,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  action: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button className={btn} onClick={onClose}>Cancel</button>
          <button
            className={danger ? "rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90" : primary}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {action}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
