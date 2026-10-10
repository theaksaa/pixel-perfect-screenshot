import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Plus, RefreshCw, MoreHorizontal, Pencil, Trash2, GitBranch, LayoutGrid } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  admin,
  ago,
  fmtTokens,
  nextRefresh,
  projectDaily,
  projectLastRefresh,
  repoMonth,
  scheduleOf,
  sum,
  useAdminProjects,
  useNow,
  type AdminProject,
  type Repo,
  type RepoStatus,
} from "@/lib/admin-store";
import { ConfirmDialog, CreateProjectDialog, RepoDialog } from "@/components/admin/AdminDialogs";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Code Atlas" },
      { name: "description", content: "Manage Code Atlas projects, repositories, analysis schedules and token usage." },
      { property: "og:title", content: "Admin — Code Atlas" },
      { property: "og:description", content: "Projects, repositories, refresh schedules and AI token usage in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const STATUS: Record<RepoStatus, { label: string; dot: string }> = {
  "up-to-date": { label: "Up to date", dot: "bg-success" },
  updating: { label: "Analyzing repository…", dot: "bg-primary animate-pulse" },
  scheduled: { label: "Scheduled", dot: "bg-warning" },
  failed: { label: "Failed", dot: "bg-destructive" },
  never: { label: "Never analyzed", dot: "bg-faint" },
};
function Status({ r, now }: { r: Repo; now: number }) {
  const s = STATUS[r.status];
  const fresh = r.status === "up-to-date" && r.lastRefresh && now - r.lastRefresh < 60_000;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={cn("size-1.5 rounded-full", s.dot)} />
      <span className={r.status === "failed" ? "text-destructive" : "text-muted-foreground"}>
        {fresh ? "Updated just now" : s.label}
      </span>
    </span>
  );
}

function Bars({ data, height = 72, labels = true }: { data: number[]; height?: number; labels?: boolean }) {
  const max = Math.max(...data, 1);
  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{ height }}>
        {data.map((v, i) => (
          <div
            key={i}
            title={`${30 - i}d ago · ${v.toLocaleString()} tokens`}
            className={cn("flex-1 rounded-[1px]", i === data.length - 1 ? "bg-primary" : "bg-primary/35 hover:bg-primary/60")}
            style={{ height: `${Math.max((v / max) * 100, 2)}%` }}
          />
        ))}
      </div>
      {labels && (
        <div className="mt-1.5 flex justify-between font-mono text-[10px] text-faint">
          <span>30d ago</span>
          <span>15d</span>
          <span>today</span>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[11px] text-faint">{label}</div>
      <div className="mt-0.5 font-mono text-lg tracking-tight">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function AdminPage() {
  const projects = useAdminProjects();
  const now = useNow();
  const [sel, setSel] = useState<string>("overview");
  const [creating, setCreating] = useState(false);
  const [repoEdit, setRepoEdit] = useState<{ repo?: Repo } | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | { title: string; body: string; action: string; danger?: boolean; run: () => void }>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("project");
    if (id) setSel(id);
  }, []);

  const project = projects.find((p) => p.id === sel);
  const detailRepo = project?.repos.find((r) => r.id === detail);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-4">
        <Link to="/" className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <rect x="7" y="1" width="4" height="4" rx="1" fill="var(--primary)" />
            <rect x="1" y="13" width="4" height="4" rx="1" fill="var(--foreground)" />
            <rect x="13" y="13" width="4" height="4" rx="1" fill="var(--foreground)" />
            <path d="M9 5 V9 H3 V13 M9 9 H15 V13" stroke="var(--faint)" strokeWidth="1.2" fill="none" />
          </svg>
          <span className="text-[13.5px] font-semibold tracking-tight">Code Atlas</span>
        </Link>
        <span className="text-border-strong">/</span>
        <span className="text-[13px]">Admin</span>
        <Link to="/" className="ml-auto flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-accent">
          <ArrowLeft className="size-3.5" /> Back to explorer
        </Link>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-64 shrink-0 flex-col border-r bg-surface/40">
          <div className="p-2">
            <button
              onClick={() => setSel("overview")}
              className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px]", sel === "overview" ? "bg-accent" : "text-muted-foreground hover:bg-surface")}
            >
              <LayoutGrid className="size-3.5" /> Overview
            </button>
          </div>
          <div className="flex items-center justify-between px-4 pb-1 pt-2">
            <span className="text-[11px] uppercase tracking-wider text-faint">Projects</span>
            <button onClick={() => setCreating(true)} className="rounded-sm p-0.5 text-faint hover:bg-surface hover:text-foreground" aria-label="New project">
              <Plus className="size-3.5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
            {projects.map((p) => {
              const busy = p.repos.some((r) => r.status === "updating");
              const failed = p.repos.some((r) => r.status === "failed");
              return (
                <button
                  key={p.id}
                  onClick={() => setSel(p.id)}
                  className={cn("mb-0.5 w-full rounded-md px-2 py-2 text-left", sel === p.id ? "bg-accent" : "hover:bg-surface")}
                >
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="truncate">{p.name}</span>
                    {(busy || failed) && <span className={cn("size-1.5 shrink-0 rounded-full", busy ? "animate-pulse bg-primary" : "bg-destructive")} />}
                  </div>
                  <div className="mt-0.5 font-mono text-[10.5px] text-faint">
                    {p.repos.length} repos · {fmtTokens(sum(projectDaily(p)))} tokens
                  </div>
                </button>
              );
            })}
          </div>
          <div className="border-t p-2">
            <button onClick={() => setCreating(true)} className="flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs hover:bg-accent">
              <Plus className="size-3.5" /> New project
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-auto">
          {project ? (
            <ProjectView
              p={project}
              now={now}
              onAdd={() => setRepoEdit({})}
              onEdit={(r) => setRepoEdit({ repo: r })}
              onDetail={(r) => setDetail(r.id)}
              onConfirm={setConfirm}
              onDeleted={() => setSel("overview")}
            />
          ) : (
            <Overview projects={projects} now={now} onOpen={setSel} onCreate={() => setCreating(true)} />
          )}
        </main>
      </div>

      <CreateProjectDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={(n, d) => {
          setSel(admin.createProject(n, d));
          setCreating(false);
        }}
      />
      <RepoDialog
        open={!!repoEdit && !!project}
        repo={repoEdit?.repo}
        onClose={() => setRepoEdit(null)}
        onSave={(v) => {
          if (project) admin.upsertRepo(project.id, v, repoEdit?.repo?.id);
          setRepoEdit(null);
        }}
      />
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ""}
        body={confirm?.body ?? ""}
        action={confirm?.action ?? ""}
        {...(confirm?.danger ? { danger: true } : {})}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm?.run()}
      />
      <Sheet open={!!detailRepo} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="w-[420px] sm:max-w-[420px]">
          {detailRepo && project && <RepoDetail r={detailRepo} now={now} onRefresh={() => admin.refresh(project.id, [detailRepo.id])} onEdit={() => setRepoEdit({ repo: detailRepo })} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Overview({ projects, now, onOpen, onCreate }: { projects: AdminProject[]; now: number; onOpen: (id: string) => void; onCreate: () => void }) {
  const totals = projects.map((p) => ({ p, t: sum(projectDaily(p)) }));
  const all = sum(totals.map((x) => x.t));
  const max = Math.max(...totals.map((x) => x.t), 1);
  const daily = Array.from({ length: 30 }, (_, i) => sum(projects.map((p) => projectDaily(p)[i] ?? 0)));
  const repos = projects.flatMap((p) => p.repos);
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">What Code Atlas analyzes, and what that analysis costs.</p>
        </div>
        <button onClick={onCreate} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="size-3.5" /> New project
        </button>
      </div>
      <div className="grid grid-cols-4 gap-px overflow-hidden rounded-lg border bg-border">
        {[
          ["Projects", `${projects.length}`],
          ["Repositories", `${repos.length}`],
          ["Tokens · last 30 days", fmtTokens(all)],
          ["Needs attention", `${repos.filter((r) => r.status === "failed").length} failed`],
        ].map(([l, v]) => (
          <div key={l} className="bg-background p-4">
            <Stat label={l!} value={v!} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-4">
        <section className="col-span-3 rounded-lg border p-5">
          <h2 className="mb-4 text-[13px] font-medium">Token usage — last 30 days</h2>
          <Bars data={daily} height={120} />
        </section>
        <section className="col-span-2 rounded-lg border p-5">
          <h2 className="mb-4 text-[13px] font-medium">Token usage by project</h2>
          <div className="space-y-3">
            {totals.sort((a, b) => b.t - a.t).map(({ p, t }) => (
              <button key={p.id} onClick={() => onOpen(p.id)} className="group block w-full text-left">
                <div className="flex justify-between text-[12.5px]">
                  <span className="group-hover:text-primary">{p.name}</span>
                  <span className="font-mono text-muted-foreground">{fmtTokens(t)}</span>
                </div>
                <div className="mt-1 h-1 rounded-full bg-surface-2">
                  <div className="h-1 rounded-full bg-primary/70" style={{ width: `${(t / max) * 100}%` }} />
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
      <section className="overflow-hidden rounded-lg border">
        <div className="grid grid-cols-[1fr_110px_140px_120px] border-b bg-surface px-4 py-2 text-[11px] text-faint">
          <span>Project</span><span>Repositories</span><span>Last refresh</span><span className="text-right">Tokens · 30d</span>
        </div>
        {projects.map((p) => (
          <button key={p.id} onClick={() => onOpen(p.id)} className="grid w-full grid-cols-[1fr_110px_140px_120px] items-center border-b px-4 py-3 text-left last:border-0 hover:bg-surface">
            <span>
              <span className="block text-[13px]">{p.name}</span>
              <span className="block text-[11.5px] text-muted-foreground">{p.description || "—"}</span>
            </span>
            <span className="font-mono text-xs text-muted-foreground">{p.repos.length}</span>
            <span className="text-xs text-muted-foreground">{ago(projectLastRefresh(p), now)}</span>
            <span className="text-right font-mono text-xs">{fmtTokens(sum(projectDaily(p)))}</span>
          </button>
        ))}
      </section>
    </div>
  );
}

function ProjectView({
  p,
  now,
  onAdd,
  onEdit,
  onDetail,
  onConfirm,
  onDeleted,
}: {
  p: AdminProject;
  now: number;
  onAdd: () => void;
  onEdit: (r: Repo) => void;
  onDetail: (r: Repo) => void;
  onConfirm: (c: { title: string; body: string; action: string; danger?: boolean; run: () => void }) => void;
  onDeleted: () => void;
}) {
  const daily = projectDaily(p);
  const month = sum(daily);
  const week = sum(daily.slice(-7));
  const last = sum(p.repos.filter((r) => r.lastRefresh).map((r) => r.lastTokens));
  const busy = p.repos.filter((r) => r.status === "updating").length;
  const sorted = [...p.repos].sort((a, b) => repoMonth(b) - repoMonth(a));
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{p.name}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{p.description || "No description"}</p>
          <div className="mt-2 flex gap-4 font-mono text-[11px] text-faint">
            <span>{p.repos.length} repositories</span>
            <span>Last full refresh: {ago(p.lastFullRefresh, now)}</span>
            {busy > 0 && <span className="text-primary">{busy} updating…</span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            disabled={!p.repos.length || busy > 0}
            onClick={() =>
              onConfirm({
                title: "Refresh all repositories?",
                body: `Code Atlas will re-analyze all ${p.repos.length} repositories in ${p.name}. Based on recent runs this uses about ${fmtTokens(last || 30_000 * p.repos.length)} tokens.`,
                action: "Refresh all",
                run: () => admin.refresh(p.id, p.repos.map((r) => r.id)),
              })
            }
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className={cn("size-3.5", busy && "animate-spin")} /> Refresh all
          </button>
          <button onClick={onAdd} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="size-3.5" /> Add repository
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-md border p-1.5 text-muted-foreground hover:bg-accent" aria-label="Project actions">
              <MoreHorizontal className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive"
                onClick={() =>
                  onConfirm({
                    title: `Delete ${p.name}?`,
                    body: "The project, its repositories and analysis history will be removed from Code Atlas.",
                    action: "Delete project",
                    danger: true,
                    run: () => {
                      admin.deleteProject(p.id);
                      onDeleted();
                    },
                  })
                }
              >
                <Trash2 className="size-3.5" /> Delete project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <section className="grid grid-cols-[220px_1fr] gap-6 rounded-lg border p-5">
        <div className="space-y-4">
          <Stat label="Last 30 days" value={`${fmtTokens(month)}`} sub="tokens" />
          <Stat label="Last 7 days" value={fmtTokens(week)} />
          <Stat label="Last analysis (all repos)" value={fmtTokens(last)} />
        </div>
        <div>
          <h2 className="mb-3 text-[13px] font-medium">Token usage — last 30 days</h2>
          <Bars data={daily} height={110} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[13px] font-medium">Repositories</h2>
        {p.repos.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <GitBranch className="mx-auto size-5 text-faint" />
            <p className="mt-2 text-[13px]">No repositories yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Add a repository and Code Atlas will analyze it on your schedule.</p>
            <button onClick={onAdd} className="mt-4 rounded-md border px-3 py-1.5 text-xs hover:bg-accent">+ Add repository</button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <div className="grid grid-cols-[minmax(0,1.6fr)_150px_130px_110px_110px_150px] gap-3 border-b bg-surface px-4 py-2 text-[11px] text-faint">
              <span>Repository</span><span>Status</span><span>Schedule</span><span>Last refresh</span><span>Tokens · 30d</span><span />
            </div>
            {sorted.map((r) => (
              <div
                key={r.id}
                onClick={() => onDetail(r)}
                className={cn("grid cursor-pointer grid-cols-[minmax(0,1.6fr)_150px_130px_110px_110px_150px] items-center gap-3 border-b px-4 py-3 last:border-0 hover:bg-surface", r.status === "updating" && "bg-primary/5")}
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium">{r.name}</div>
                  <div className="flex items-center gap-2 truncate font-mono text-[10.5px] text-faint">
                    <span className="truncate">{r.url.replace(/^https?:\/\//, "")}</span>
                    <span className="flex shrink-0 items-center gap-0.5"><GitBranch className="size-3" />{r.branch}</span>
                  </div>
                </div>
                <div>
                  <Status r={r} now={now} />
                  <div className="mt-0.5 text-[10.5px] text-faint">Next {nextRefresh(r, now)}</div>
                </div>
                <span className="text-xs text-muted-foreground">{scheduleOf(r).label}</span>
                <span className="text-xs text-muted-foreground">{ago(r.lastRefresh, now)}</span>
                <div>
                  <div className="font-mono text-xs">{fmtTokens(repoMonth(r))}</div>
                  <div className="font-mono text-[10.5px] text-faint">last {fmtTokens(r.lastTokens)}</div>
                </div>
                <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => onEdit(r)} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent" aria-label={`Edit ${r.name}`}>
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    onClick={() =>
                      onConfirm({
                        title: `Remove ${r.name}?`,
                        body: "Code Atlas will stop analyzing this repository. Existing graph data stays until the next project refresh.",
                        action: "Remove repository",
                        danger: true,
                        run: () => admin.deleteRepo(p.id, r.id),
                      })
                    }
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                    aria-label={`Remove ${r.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                  <button
                    disabled={r.status === "updating"}
                    onClick={() => admin.refresh(p.id, [r.id])}
                    className="ml-1 flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] hover:bg-accent disabled:opacity-50"
                  >
                    <RefreshCw className={cn("size-3", r.status === "updating" && "animate-spin")} /> Refresh now
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RepoDetail({ r, now, onRefresh, onEdit }: { r: Repo; now: number; onRefresh: () => void; onEdit: () => void }) {
  const month = repoMonth(r);
  const avg = r.analyses ? Math.round(month / r.analyses) : 0;
  const input = Math.round(month * 0.78);
  const s = scheduleOf(r);
  return (
    <div className="flex h-full flex-col gap-5 overflow-auto">
      <SheetHeader>
        <SheetTitle className="font-mono text-base">{r.name}</SheetTitle>
        <SheetDescription className="font-mono text-[11px]">{r.url}</SheetDescription>
      </SheetHeader>
      <div className="space-y-2 rounded-lg border p-4 text-xs">
        {[
          ["Status", <Status key="s" r={r} now={now} />],
          ["Branch", <span key="b" className="font-mono">{r.branch}</span>],
          ["Schedule", <span key="c">{s.label}{s.cron && <span className="ml-2 font-mono text-faint">{s.cron}</span>}</span>],
          ["Last refresh", ago(r.lastRefresh, now)],
          ["Next refresh", nextRefresh(r, now)],
        ].map(([k, v]) => (
          <div key={k as string} className="flex justify-between gap-4">
            <span className="text-faint">{k}</span>
            <span className="text-right text-muted-foreground">{v}</span>
          </div>
        ))}
        {r.error && <p className="mt-2 rounded-md bg-destructive/10 p-2 text-destructive">{r.error}</p>}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Last analysis" value={r.lastTokens.toLocaleString()} />
        <Stat label="Last 30 days" value={fmtTokens(month)} />
        <Stat label="Avg. analysis" value={fmtTokens(avg)} />
      </div>
      <div>
        <div className="mb-2 flex justify-between text-[11px] text-faint">
          <span>Input {fmtTokens(input)}</span>
          <span>Output {fmtTokens(month - input)}</span>
        </div>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="bg-primary/70" style={{ width: "78%" }} />
          <div className="bg-success/70" style={{ width: "22%" }} />
        </div>
      </div>
      <div>
        <h3 className="mb-3 text-[12.5px] font-medium">Usage over time</h3>
        <Bars data={r.daily} height={90} />
        <p className="mt-3 text-[11px] text-faint">{r.analyses} analyses in the last 30 days</p>
      </div>
      <div className="mt-auto flex gap-2 border-t pt-4">
        <button onClick={onEdit} className="flex-1 rounded-md border px-3 py-1.5 text-xs hover:bg-accent">Edit schedule</button>
        <button
          disabled={r.status === "updating"}
          onClick={onRefresh}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <RefreshCw className={cn("size-3.5", r.status === "updating" && "animate-spin")} />
          {r.status === "updating" ? "Analyzing…" : "Refresh now"}
        </button>
      </div>
    </div>
  );
}
