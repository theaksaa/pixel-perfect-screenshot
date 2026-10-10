import { useEffect, useState, useSyncExternalStore } from "react";

export type RepoStatus = "up-to-date" | "updating" | "scheduled" | "failed" | "never";

export interface SchedulePreset {
  id: string;
  label: string;
  cron: string;
  intervalMs: number | null;
}
const H = 3_600_000;
export const SCHEDULES: SchedulePreset[] = [
  { id: "1h", label: "Every hour", cron: "0 * * * *", intervalMs: H },
  { id: "6h", label: "Every 6 hours", cron: "0 */6 * * *", intervalMs: 6 * H },
  { id: "12h", label: "Every 12 hours", cron: "0 */12 * * *", intervalMs: 12 * H },
  { id: "daily", label: "Every day", cron: "0 0 * * *", intervalMs: 24 * H },
  { id: "daily-0200", label: "Every day at 02:00", cron: "0 2 * * *", intervalMs: 24 * H },
  { id: "weekly-mon", label: "Every Monday at 03:00", cron: "0 3 * * 1", intervalMs: 168 * H },
  { id: "manual", label: "Manual only", cron: "", intervalMs: null },
];
export const scheduleOf = (r: Repo): SchedulePreset =>
  SCHEDULES.find((s) => s.id === r.schedule) ?? {
    id: "custom",
    label: "Custom",
    cron: r.cron,
    intervalMs: 24 * H,
  };

export interface Repo {
  id: string;
  name: string;
  url: string;
  branch: string;
  schedule: string; // preset id or "custom"
  cron: string;
  status: RepoStatus;
  lastRefresh: number | null;
  lastTokens: number;
  analyses: number;
  daily: number[]; // 30 days, oldest first
  error?: string;
}
export interface AdminProject {
  id: string;
  name: string;
  description: string;
  repos: Repo[];
  lastFullRefresh: number | null;
}

function rand(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
function series(seed: string, total: number) {
  const r = rand(seed);
  const raw = Array.from({ length: 30 }, (_, i) => (0.4 + r()) * (0.7 + i / 60) * (r() < 0.12 ? 2.2 : 1));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((v) => Math.round((v / sum) * total));
}
const M = 60_000;
function repo(
  project: string,
  name: string,
  monthly: number,
  schedule: string,
  agoMin: number | null,
  status: RepoStatus = "up-to-date",
  org = "acme",
): Repo {
  const r = rand(name);
  const preset = SCHEDULES.find((s) => s.id === schedule)!;
  return {
    id: `${project}:${name}`,
    name,
    url: `https://github.com/${org}/${name}`,
    branch: r() < 0.8 ? "main" : "develop",
    schedule,
    cron: preset.cron,
    status,
    lastRefresh: agoMin === null ? null : Date.now() - agoMin * M,
    lastTokens: agoMin === null ? 0 : Math.round((monthly / (8 + r() * 6)) * 10) / 10,
    analyses: agoMin === null ? 0 : 6 + Math.round(r() * 20),
    daily: agoMin === null ? Array(30).fill(0) : series(name, monthly),
    ...(status === "failed"
      ? { error: "Clone failed: repository access token expired (401)." }
      : {}),
  };
}

function seed(): AdminProject[] {
  return [
    {
      id: "platform",
      name: "Acme Platform",
      description: "Distributed commerce system",
      lastFullRefresh: Date.now() - 2 * 60 * M,
      repos: [
        repo("platform", "order-service", 284_102, "6h", 12),
        repo("platform", "payment-service", 231_400, "daily-0200", 5 * 60),
        repo("platform", "inventory-service", 198_300, "6h", 47),
        repo("platform", "frontend", 152_800, "12h", 3 * 60),
        repo("platform", "api-gateway", 148_600, "daily", 9 * 60),
        repo("platform", "shipping-service", 141_200, "6h", 6 * 60 + 20, "failed"),
        repo("platform", "notification-service", 84_000, "weekly-mon", 2 * 24 * 60),
      ],
    },
    {
      id: "idp",
      name: "Internal Developer Platform",
      description: "Build, deploy and observability tooling",
      lastFullRefresh: Date.now() - 26 * 60 * M,
      repos: [
        ["build-orchestrator", 412_000, "6h", 34],
        ["deploy-controller", 365_000, "6h", 80],
        ["service-catalog", 301_000, "12h", 220],
        ["secrets-broker", 288_000, "daily-0200", 600],
        ["metrics-pipeline", 276_000, "6h", 15],
        ["log-indexer", 254_000, "daily", 700],
        ["feature-flags", 219_000, "12h", 300],
        ["ci-runners", 198_000, "6h", 140],
        ["dev-portal", 151_000, "daily", 400],
        ["cost-explorer", 132_000, "weekly-mon", 3000],
        ["policy-engine", 121_000, "daily-0200", 640],
        ["sandbox-envs", 92_000, "manual", null],
      ].map(([n, t, s, a]) =>
        repo("idp", n as string, t as number, s as string, a as number | null, a === null ? "never" : "up-to-date", "acme-infra"),
      ),
    },
    {
      id: "mobile",
      name: "Mobile Platform",
      description: "iOS and Android apps with shared BFF",
      lastFullRefresh: Date.now() - 4 * 24 * 60 * M,
      repos: [
        repo("mobile", "ios-app", 238_000, "daily", 900, "up-to-date", "acme-mobile"),
        repo("mobile", "android-app", 211_000, "daily", 910, "up-to-date", "acme-mobile"),
        repo("mobile", "mobile-bff", 129_000, "12h", 200, "scheduled", "acme-mobile"),
        repo("mobile", "design-tokens", 52_000, "weekly-mon", 5000, "up-to-date", "acme-mobile"),
      ],
    },
  ];
}

const KEY = "code-atlas-admin";
let state: AdminProject[] | null = null;
const listeners = new Set<() => void>();
const SERVER: AdminProject[] = [];

function load(): AdminProject[] {
  if (state) return state;
  try {
    const saved = localStorage.getItem(KEY);
    state = saved ? (JSON.parse(saved) as AdminProject[]) : seed();
    // Refreshes interrupted by a reload should not stay stuck.
    state = state.map((p) => ({
      ...p,
      repos: p.repos.map((r) => (r.status === "updating" ? { ...r, status: "up-to-date" } : r)),
    }));
  } catch {
    state = seed();
  }
  return state;
}
function set(next: AdminProject[]) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useAdminProjects() {
  return useSyncExternalStore(subscribe, load, () => SERVER);
}
export function useNow(ms = 15_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";

export const admin = {
  createProject(name: string, description: string): string {
    const all = load();
    let id = slug(name);
    while (all.some((p) => p.id === id)) id += "-2";
    set([...all, { id, name, description, repos: [], lastFullRefresh: null }]);
    return id;
  },
  ensureProject(id: string, name: string, description = "") {
    if (!load().some((p) => p.id === id))
      set([...load(), { id, name, description, repos: [], lastFullRefresh: null }]);
  },
  deleteProject(id: string) {
    set(load().filter((p) => p.id !== id));
  },
  updateProject(id: string, patch: Partial<AdminProject>) {
    set(load().map((p) => (p.id === id ? { ...p, ...patch } : p)));
  },
  upsertRepo(projectId: string, input: Pick<Repo, "name" | "url" | "branch" | "schedule" | "cron">, repoId?: string) {
    set(
      load().map((p) => {
        if (p.id !== projectId) return p;
        if (repoId)
          return { ...p, repos: p.repos.map((r) => (r.id === repoId ? { ...r, ...input } : r)) };
        const r: Repo = {
          ...input,
          id: `${projectId}:${input.name}:${Date.now()}`,
          status: "never",
          lastRefresh: null,
          lastTokens: 0,
          analyses: 0,
          daily: Array(30).fill(0),
        };
        return { ...p, repos: [...p.repos, r] };
      }),
    );
  },
  deleteRepo(projectId: string, repoId: string) {
    set(load().map((p) => (p.id === projectId ? { ...p, repos: p.repos.filter((r) => r.id !== repoId) } : p)));
  },
  refresh(projectId: string, repoIds: string[]) {
    const patch = (id: string, fn: (r: Repo) => Repo) =>
      set(load().map((p) => (p.id === projectId ? { ...p, repos: p.repos.map((r) => (r.id === id ? fn(r) : r)) } : p)));
    repoIds.forEach((id, i) => {
      patch(id, (r) => ({ ...r, status: "updating" }));
      setTimeout(() => {
        patch(id, (r) => {
          const avg = r.analyses ? r.daily.reduce((a, b) => a + b, 0) / Math.max(r.analyses, 1) : 30_000;
          const tokens = Math.round(avg * (0.85 + Math.random() * 0.3));
          const daily = [...r.daily];
          daily[29] = (daily[29] ?? 0) + tokens;
          const { error: _e, ...rest } = r;
          return { ...rest, status: "up-to-date", lastRefresh: Date.now(), lastTokens: tokens, analyses: r.analyses + 1, daily };
        });
        if (repoIds.length > 1 && i === repoIds.length - 1)
          admin.updateProject(projectId, { lastFullRefresh: Date.now() });
      }, 1800 + i * 900 + Math.random() * 1200);
    });
  },
};

export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
export const repoMonth = (r: Repo) => sum(r.daily);
export const projectDaily = (p: AdminProject) =>
  Array.from({ length: 30 }, (_, i) => sum(p.repos.map((r) => r.daily[i] ?? 0)));
export const projectLastRefresh = (p: AdminProject) =>
  p.repos.reduce<number | null>((m, r) => (r.lastRefresh && (!m || r.lastRefresh > m) ? r.lastRefresh : m), null);

export function fmtTokens(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
  return `${Math.round(n)}`;
}
export function ago(t: number | null, now: number) {
  if (!t) return "Never";
  const m = Math.round((now - t) / M);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
export function nextRefresh(r: Repo, now: number) {
  const s = scheduleOf(r);
  if (!s.intervalMs) return "—";
  if (r.status === "updating") return "after current run";
  const due = (r.lastRefresh ?? now) + s.intervalMs - now;
  if (due <= 0) return "due now";
  const m = Math.round(due / M);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `in ${h}h ${m % 60}m` : `in ${Math.round(h / 24)}d`;
}
