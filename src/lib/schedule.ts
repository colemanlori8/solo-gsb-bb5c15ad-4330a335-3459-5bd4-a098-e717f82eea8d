import type { CueEdge, CueNode, NodeSchedule, ScheduleResult } from '../types';

/**
 * 舞台提示链调度引擎（CPM 关键路径法）：
 *
 * 约定边 source -> target 表示「source 完成后，再延迟 target.delay 秒，target 才能触发」。
 *  - 前向传递：ES(v) = max over preds u of (EF(u) + delay(v))
 *  - 后向传递：LF(u) = min over succs v of (LS(v) - delay(v))
 *  - slack = LS - ES；slack === 0 的节点在关键路径上。
 */

const EPS = 1e-6;

export function hasCycle(nodes: CueNode[], edges: CueEdge[]): boolean {
  return !topoSort(nodes, edges);
}

/** 拓扑排序（按 id 稳定排序，保证结果可复现）；存在环时返回 null */
export function topoSort(nodes: CueNode[], edges: CueEdge[]): string[] | null {
  const ids = new Set(nodes.map((n) => n.id));
  const indeg = new Map<string, number>();
  const succ = new Map<string, string[]>();

  nodes.forEach((n) => {
    indeg.set(n.id, 0);
    succ.set(n.id, []);
  });

  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) continue;
    succ.get(e.source)!.push(e.target);
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  }

  const ready = nodes
    .filter((n) => (indeg.get(n.id) ?? 0) === 0)
    .map((n) => n.id)
    .sort();
  const order: string[] = [];

  while (ready.length) {
    const id = ready.shift()!;
    order.push(id);
    for (const next of succ.get(id) ?? []) {
      const d = (indeg.get(next) ?? 0) - 1;
      indeg.set(next, d);
      if (d === 0) {
        ready.push(next);
        ready.sort();
      }
    }
  }

  return order.length === nodes.length ? order : null;
}

/** 加入候选边/删除边后是否会形成（或仍有）环，用于连线拦截 */
export function wouldCycle(
  nodes: CueNode[],
  edges: CueEdge[],
  candidate: { source: string; target: string },
): boolean {
  if (candidate.source === candidate.target) return true;
  const next: CueEdge[] = [
    ...edges,
    { id: `__probe_${candidate.source}_${candidate.target}`, ...candidate },
  ];
  return hasCycle(nodes, next);
}

/** 空结果（环图或空图复用） */
function emptyResult(cyclic: boolean, order: string[] = []): ScheduleResult {
  return { map: {}, criticalPath: [], criticalEdges: [], makespan: 0, cyclic, order };
}

export function computeSchedule(nodes: CueNode[], edges: CueEdge[]): ScheduleResult {
  const order = topoSort(nodes, edges);
  if (!order) return emptyResult(true);
  if (nodes.length === 0) return emptyResult(false);

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const preds = new Map<string, string[]>();
  const succs = new Map<string, string[]>();
  order.forEach((id) => {
    preds.set(id, []);
    succs.set(id, []);
  });
  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue;
    preds.get(e.target)!.push(e.source);
    succs.get(e.source)!.push(e.target);
  }

  // ---- 前向传递 ----
  const es = new Map<string, number>();
  const ef = new Map<string, number>();
  for (const id of order) {
    const node = byId.get(id)!;
    const delay = clampNum(node.data.delay);
    const dur = clampNum(node.data.duration);
    let start = delay; // 无前驱时：相对开场的延迟
    for (const p of preds.get(id) ?? []) {
      start = Math.max(start, (ef.get(p) ?? 0) + delay);
    }
    es.set(id, start);
    ef.set(id, start + dur);
  }

  const makespan = Math.max(0, ...order.map((id) => ef.get(id) ?? 0));

  // ---- 后向传递 ----
  const lf = new Map<string, number>();
  const ls = new Map<string, number>();
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    const node = byId.get(id)!;
    const delay = clampNum(node.data.delay);
    const dur = clampNum(node.data.duration);
    const children = succs.get(id) ?? [];
    let finish = makespan; // 无后继时：最晚在总时长处完成
    if (children.length) {
      finish = Math.min(...children.map((c) => (ls.get(c) ?? makespan) - delay));
    }
    lf.set(id, finish);
    ls.set(id, finish - dur);
  }

  // ---- 机动时间 / 关键节点 ----
  const map: Record<string, NodeSchedule> = {};
  for (const id of order) {
    const slack = Math.max(0, (ls.get(id) ?? 0) - (es.get(id) ?? 0));
    map[id] = {
      es: es.get(id) ?? 0,
      ef: ef.get(id) ?? 0,
      ls: ls.get(id) ?? 0,
      lf: lf.get(id) ?? 0,
      slack,
      critical: slack <= EPS,
    };
  }

  // 紧边：ES(target) === EF(source) + delay(target)，且两端均关键
  const criticalEdges: string[] = [];
  for (const e of edges) {
    const t = map[e.target];
    const s = map[e.source];
    const target = byId.get(e.target);
    if (!t || !s || !target) continue;
    const tight = Math.abs(s.ef + clampNum(target.data.delay) - t.es) <= EPS;
    if (tight && s.critical && t.critical) criticalEdges.push(e.id);
  }

  // 从「EF 等于总时长的关键汇点」沿关键前驱回溯，得到一条完整关键链
  const sink = [...order]
    .reverse()
    .find(
      (id) =>
        map[id].critical &&
        Math.abs(map[id].ef - makespan) <= EPS &&
        (succs.get(id)?.length ?? 0) === 0,
    );

  const criticalPath: string[] = [];
  if (sink) {
    let cur: string | undefined = sink;
    while (cur) {
      criticalPath.unshift(cur);
      const parents: string[] = (preds.get(cur) ?? []).filter((p) => {
        if (!map[p]?.critical || !map[cur!]?.critical) return false;
        // 紧边判定使用目标节点(cur)的延迟：ES(cur) = EF(p) + delay(cur)
        return (
          Math.abs(map[p].ef + clampNum(byId.get(cur!)!.data.delay) - map[cur!].es) <=
          EPS
        );
      });
      cur = parents.sort().pop();
    }
  }

  return { map, criticalPath, criticalEdges, makespan, cyclic: false, order };
}

export function clampNum(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}
