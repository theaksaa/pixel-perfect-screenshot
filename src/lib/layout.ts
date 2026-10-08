/**
 * Layered (Sugiyama-style) top-to-bottom layout with dummy nodes for long edges,
 * barycenter crossing minimisation and orthogonal edge routing through layer gaps,
 * so edges never pass through nodes.
 */

export interface Pt { x: number; y: number; h: number }
export interface Routed { d: string; lx: number; ly: number }
export interface RoutedEdge extends Routed { reversed: boolean }

function seg(x1: number, y1: number, x2: number, y2: number, mid: number) {
  if (Math.abs(x1 - x2) < 1) return `M${x1},${y1} V${y2}`;
  const r = Math.max(0, Math.min(10, Math.abs(x2 - x1) / 2, Math.abs(mid - y1), Math.abs(y2 - mid)));
  const s = x2 > x1 ? 1 : -1;
  return `M${x1},${y1} V${mid - r} Q${x1},${mid} ${x1 + s * r},${mid} H${x2 - s * r} Q${x2},${mid} ${x2},${mid + r} V${y2}`;
}

export function routeChain(pts: Pt[], frac = 0.5, endGap = 3, startGap = 0): Routed {
  let d = "";
  let lx = 0;
  let ly = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i]!;
    const q = pts[i + 1]!;
    const last = i === pts.length - 2;
    const y1 = p.y + p.h / 2 + (i === 0 ? startGap : 0);
    const y2 = q.y - q.h / 2 - (last ? endGap : 0);
    const mid = y1 + (y2 - y1) * frac;
    d += seg(p.x, y1, q.x, y2, mid) + " ";
    if (last) {
      lx = q.x;
      ly = Math.abs(p.x - q.x) < 1 ? (y1 + y2) / 2 : (mid + y2) / 2 + 2;
    }
  }
  return { d: d.trim(), lx, ly };
}

export interface LayoutIn { key: string; w: number; h: number }

const DUMMY_W = 14;

export function layered(
  nodes: LayoutIn[],
  edges: { from: string; to: string }[],
  opts: { gapX: number; gapY: number; frac: (from: string) => number },
): { pos: Record<string, { x: number; y: number }>; routes: (RoutedEdge | null)[] } {
  const info = new Map<string, { w: number; h: number; dummy: boolean }>();
  nodes.forEach((n) => info.set(n.key, { w: n.w, h: n.h, dummy: false }));
  const H = Math.max(0, ...nodes.map((n) => n.h));
  const ids = nodes.map((n) => n.key);
  const valid = edges.map((e, i) => ({ ...e, i })).filter((e) => info.has(e.from) && info.has(e.to) && e.from !== e.to);

  // 1. cycle removal (reverse DFS back edges)
  const outE = new Map<string, typeof valid>(ids.map((i) => [i, []]));
  const indeg = new Map<string, number>(ids.map((i) => [i, 0]));
  valid.forEach((e) => { outE.get(e.from)!.push(e); indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1); });
  const state = new Map<string, number>();
  const back = new Set<number>();
  const visit = (u: string) => {
    state.set(u, 1);
    for (const e of outE.get(u)!) {
      const s = state.get(e.to);
      if (s === 1) back.add(e.i);
      else if (!s) visit(e.to);
    }
    state.set(u, 2);
  };
  [...ids].sort((a, b) => (indeg.get(a) === 0 ? 0 : 1) - (indeg.get(b) === 0 ? 0 : 1)).forEach((u) => { if (!state.get(u)) visit(u); });
  const dag = valid.map((e) => (back.has(e.i) ? { a: e.to, b: e.from, rev: true, i: e.i } : { a: e.from, b: e.to, rev: false, i: e.i }));

  // 2. layering (longest path, sources pulled down next to their children)
  const succ = new Map<string, string[]>(ids.map((i) => [i, []]));
  const pred = new Map<string, string[]>(ids.map((i) => [i, []]));
  dag.forEach((e) => { succ.get(e.a)!.push(e.b); pred.get(e.b)!.push(e.a); });
  const deg = new Map(ids.map((i) => [i, pred.get(i)!.length]));
  const queue = ids.filter((i) => deg.get(i) === 0);
  const topo: string[] = [];
  while (queue.length) {
    const u = queue.shift()!;
    topo.push(u);
    for (const v of succ.get(u)!) { deg.set(v, deg.get(v)! - 1); if (deg.get(v) === 0) queue.push(v); }
  }
  ids.forEach((i) => { if (!topo.includes(i)) topo.push(i); });
  const layer = new Map<string, number>(ids.map((i) => [i, 0]));
  topo.forEach((u) => succ.get(u)!.forEach((v) => layer.set(v, Math.max(layer.get(v)!, layer.get(u)! + 1))));
  [...topo].reverse().forEach((u) => {
    const s = succ.get(u)!;
    if (pred.get(u)!.length === 0 && s.length) layer.set(u, Math.min(...s.map((v) => layer.get(v)!)) - 1);
  });
  const minL = Math.min(0, ...ids.map((i) => layer.get(i)!));
  ids.forEach((i) => layer.set(i, layer.get(i)! - minL));
  const maxL = Math.max(0, ...ids.map((i) => layer.get(i)!));

  // 3. dummy nodes
  let L: string[][] = Array.from({ length: maxL + 1 }, () => []);
  topo.forEach((u) => L[layer.get(u)!]!.push(u));
  const up = new Map<string, string[]>();
  const down = new Map<string, string[]>();
  const link = (a: string, b: string) => {
    if (!down.has(a)) down.set(a, []);
    if (!up.has(b)) up.set(b, []);
    down.get(a)!.push(b);
    up.get(b)!.push(a);
  };
  const chains = dag.map((e) => {
    const c = [e.a];
    for (let l = layer.get(e.a)! + 1; l < layer.get(e.b)!; l++) {
      const d = `__d${e.i}_${l}`;
      info.set(d, { w: DUMMY_W, h: 0, dummy: true });
      L[l]!.push(d);
      layer.set(d, l);
      c.push(d);
    }
    c.push(e.b);
    for (let k = 0; k < c.length - 1; k++) link(c[k]!, c[k + 1]!);
    return { ...e, c };
  });

  // 4. ordering (barycenter sweeps, keep best)
  const idx = new Map<string, number>();
  const reidx = () => L.forEach((l) => l.forEach((v, i) => idx.set(v, i)));
  reidx();
  const crossings = () => {
    let c = 0;
    for (let l = 0; l < maxL; l++) {
      const es: [number, number][] = [];
      L[l]!.forEach((v) => (down.get(v) ?? []).forEach((w) => es.push([idx.get(v)!, idx.get(w)!])));
      for (let i = 0; i < es.length; i++)
        for (let j = i + 1; j < es.length; j++)
          if ((es[i]![0] - es[j]![0]) * (es[i]![1] - es[j]![1]) < 0) c++;
    }
    return c;
  };
  const bary = (v: string, nb: Map<string, string[]>) => {
    const ns = nb.get(v);
    if (!ns?.length) return idx.get(v)!;
    return ns.reduce((s, n) => s + idx.get(n)!, 0) / ns.length;
  };
  let best = crossings();
  let bestL = L.map((l) => [...l]);
  for (let it = 0; it < 16 && best > 0; it++) {
    const range = it % 2 === 0 ? Array.from({ length: maxL }, (_, k) => k + 1) : Array.from({ length: maxL }, (_, k) => maxL - 1 - k);
    const nb = it % 2 === 0 ? up : down;
    for (const l of range) {
      const k = new Map(L[l]!.map((v) => [v, bary(v, nb)]));
      L[l]!.sort((a, b) => k.get(a)! - k.get(b)!);
      L[l]!.forEach((v, i) => idx.set(v, i));
    }
    const c = crossings();
    if (c < best) { best = c; bestL = L.map((l) => [...l]); }
  }
  L = bestL;
  reidx();

  // 5. x coordinates
  const x = new Map<string, number>();
  const sep = (a: string, b: string) => {
    const A = info.get(a)!;
    const B = info.get(b)!;
    return A.w / 2 + B.w / 2 + (A.dummy || B.dummy ? opts.gapX / 2 : opts.gapX);
  };
  L.forEach((l) => {
    let cx = 0;
    l.forEach((v, i) => { if (i > 0) cx += sep(l[i - 1]!, v); x.set(v, cx); });
    l.forEach((v) => x.set(v, x.get(v)! - cx / 2));
  });
  const place = (l: string[], des: number[]) => {
    const n = l.length;
    if (!n) return;
    const a = [...des];
    const b = [...des];
    for (let i = 1; i < n; i++) a[i] = Math.max(des[i]!, a[i - 1]! + sep(l[i - 1]!, l[i]!));
    for (let i = n - 2; i >= 0; i--) b[i] = Math.min(des[i]!, b[i + 1]! - sep(l[i]!, l[i + 1]!));
    const c = des.map((_, i) => (a[i]! + b[i]!) / 2);
    for (let i = 1; i < n; i++) c[i] = Math.max(c[i]!, c[i - 1]! + sep(l[i - 1]!, l[i]!));
    l.forEach((v, i) => x.set(v, c[i]!));
  };
  const avg = (v: string, ns: string[]) => (ns.length ? ns.reduce((s, n) => s + x.get(n)!, 0) / ns.length : x.get(v)!);
  for (let it = 0; it < 12; it++) {
    const useUp = it % 2 === 0;
    const order = useUp ? Array.from({ length: maxL }, (_, k) => k + 1) : Array.from({ length: maxL }, (_, k) => maxL - 1 - k);
    for (const l of order) {
      const lay = L[l]!;
      const des = lay.map((v) => (it >= 10 ? avg(v, [...(up.get(v) ?? []), ...(down.get(v) ?? [])]) : avg(v, (useUp ? up : down).get(v) ?? [])));
      place(lay, des);
    }
  }

  const yOf = (k: string) => layer.get(k)! * (H + opts.gapY);
  const routes: (RoutedEdge | null)[] = edges.map(() => null);
  chains.forEach((e) => {
    const pts = e.c.map((k) => ({ x: x.get(k)!, y: yOf(k), h: info.get(k)!.h }));
    routes[e.i] = { ...routeChain(pts, opts.frac(e.a), e.rev ? 0 : 3, e.rev ? 3 : 0), reversed: e.rev };
  });
  const pos: Record<string, { x: number; y: number }> = {};
  ids.forEach((k) => { pos[k] = { x: x.get(k)!, y: yOf(k) }; });
  return { pos, routes };
}
