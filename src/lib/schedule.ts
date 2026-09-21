/**
 * 调度核心：纯函数实现，独立于 React Flow，便于测试。
 *
 * 模型约定：
 * - 每条连线 source -> target 表示「target 依赖 source」；
 * - 节点 v 的最早触发时刻 = max(所有前置的最早结束时刻) + v.delay（无前置时基准为 0）；
 * - 最早结束时刻 = 最早触发时刻 + v.duration；
 * - 总时长 = 所有节点最早结束时刻的最大值；
 * - 反向传递求最晚时刻，松弛为 0 的节点构成关键路径。
 */

export interface SchedNodeLike {
  id: string;
  data: { duration: number; delay: number };
}

export interface SchedEdgeLike {
  id: string;
  source: string;
  target: string;
}

export interface NodeSchedule {
  earliestStart: number;
  earliestEnd: number;
  latestStart: number;
  latestEnd: number;
  /** 松弛时间（秒）：可以推迟而不影响总时长的余量 */
  slack: number;
  /** 是否在关键路径上 */
  critical: boolean;
}

export interface ScheduleResult {
  byId: Map<string, NodeSchedule>;
  criticalNodeIds: Set<string>;
  criticalEdgeIds: Set<string>;
  totalDuration: number;
  /** 图中存在环（正常情况下被 UI / 导入校验阻止，此处兜底） */
  hasCycle: boolean;
}

const EPS = 1e-9;

function nonNeg(v: number): number {
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * 若新增一条 source -> target 的边，是否会形成环路。
 * 等价于：在现有图中 target 已经可以到达 source（或二者相同）。
 */
export function wouldCreateCycle(
  edges: SchedEdgeLike[],
  source: string,
  target: string,
): boolean {
  if (source === target) return true;
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.source);
    if (list) list.push(e.target);
    else adj.set(e.source, [e.target]);
  }
  const stack = [target];
  const seen = new Set<string>([target]);
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (cur === source) return true;
    for (const nxt of adj.get(cur) ?? []) {
      if (!seen.has(nxt)) {
        seen.add(nxt);
        stack.push(nxt);
      }
    }
  }
  return false;
}

/** Kahn 拓扑排序；若存在环，返回的 order 会短于节点数。 */
function topoOrder(nodes: { id: string }[], edges: SchedEdgeLike[]): string[] {
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of nodes) {
    indeg.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of edges) {
    if (!indeg.has(e.source) || !indeg.has(e.target)) continue;
    adj.get(e.source)!.push(e.target);
    indeg.set(e.target, indeg.get(e.target)! + 1);
  }
  const queue = nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const nxt of adj.get(id) ?? []) {
      const d = indeg.get(nxt)! - 1;
      indeg.set(nxt, d);
      if (d === 0) queue.push(nxt);
    }
  }
  return order;
}

/** 计算所有节点的最早/最晚时刻、松弛与关键路径。 */
export function computeSchedule<N extends SchedNodeLike>(
  nodes: N[],
  edges: SchedEdgeLike[],
): ScheduleResult {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const validEdges = edges.filter((e) => nodeById.has(e.source) && nodeById.has(e.target));
  const order = topoOrder(nodes, validEdges);
  const hasCycle = order.length !== nodes.length;

  const preds = new Map<string, string[]>();
  const succs = new Map<string, string[]>();
  for (const n of nodes) {
    preds.set(n.id, []);
    succs.set(n.id, []);
  }
  for (const e of validEdges) {
    preds.get(e.target)!.push(e.source);
    succs.get(e.source)!.push(e.target);
  }

  // 正向传递：最早时刻
  const earliestStart = new Map<string, number>();
  const earliestEnd = new Map<string, number>();
  for (const id of order) {
    const n = nodeById.get(id)!;
    let base = 0;
    for (const p of preds.get(id)!) {
      base = Math.max(base, earliestEnd.get(p) ?? 0);
    }
    const start = base + nonNeg(n.data.delay);
    earliestStart.set(id, start);
    earliestEnd.set(id, start + nonNeg(n.data.duration));
  }
  const totalDuration = Math.max(0, ...earliestEnd.values());

  // 反向传递：最晚时刻
  const latestStart = new Map<string, number>();
  const latestEnd = new Map<string, number>();
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    const n = nodeById.get(id)!;
    let le = totalDuration;
    for (const s of succs.get(id)!) {
      const succDelay = nonNeg(nodeById.get(s)!.data.delay);
      le = Math.min(le, (latestStart.get(s) ?? totalDuration) - succDelay);
    }
    latestEnd.set(id, le);
    latestStart.set(id, le - nonNeg(n.data.duration));
  }

  const byId = new Map<string, NodeSchedule>();
  const criticalNodeIds = new Set<string>();
  for (const id of order) {
    const es = earliestStart.get(id)!;
    const ee = earliestEnd.get(id)!;
    const ls = latestStart.get(id)!;
    const le = latestEnd.get(id)!;
    const slack = Math.max(0, ls - es);
    const critical = slack < EPS;
    if (critical) criticalNodeIds.add(id);
    byId.set(id, {
      earliestStart: es,
      earliestEnd: ee,
      latestStart: ls,
      latestEnd: le,
      slack,
      critical,
    });
  }

  // 关键边：两端都在关键路径上，且依赖约束被顶满（无缓冲）
  const criticalEdgeIds = new Set<string>();
  for (const e of validEdges) {
    const a = byId.get(e.source);
    const b = byId.get(e.target);
    if (!a?.critical || !b?.critical) continue;
    const targetDelay = nonNeg(nodeById.get(e.target)!.data.delay);
    if (Math.abs(a.earliestEnd + targetDelay - b.earliestStart) < EPS) {
      criticalEdgeIds.add(e.id);
    }
  }

  return { byId, criticalNodeIds, criticalEdgeIds, totalDuration, hasCycle };
}

/**
 * 简单分层布局：层 = 距根节点的最长路径（按边数），
 * 同层节点纵向排列。用于「整理布局」与示例数据。
 */
export function layeredLayout(
  nodes: { id: string }[],
  edges: SchedEdgeLike[],
  opts: { xGap?: number; yGap?: number; x0?: number; y0?: number } = {},
): Map<string, { x: number; y: number }> {
  const { xGap = 280, yGap = 120, x0 = 60, y0 = 60 } = opts;
  const ids = new Set(nodes.map((n) => n.id));
  const preds = new Map<string, string[]>();
  const succs = new Map<string, string[]>();
  for (const n of nodes) {
    preds.set(n.id, []);
    succs.set(n.id, []);
  }
  for (const e of edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) continue;
    preds.get(e.target)!.push(e.source);
    succs.get(e.source)!.push(e.target);
  }

  const order = topoOrder(nodes, edges);
  const layer = new Map<string, number>();
  for (const id of order) {
    let l = 0;
    for (const p of preds.get(id)!) {
      l = Math.max(l, (layer.get(p) ?? 0) + 1);
    }
    layer.set(id, l);
  }
  // 兜底：环中节点（正常不会发生）放到第 0 层
  for (const n of nodes) if (!layer.has(n.id)) layer.set(n.id, 0);

  const byLayer = new Map<number, string[]>();
  for (const n of nodes) {
    const l = layer.get(n.id)!;
    const arr = byLayer.get(l) ?? [];
    arr.push(n.id);
    byLayer.set(l, arr);
  }

  const pos = new Map<string, { x: number; y: number }>();
  for (const [l, layerIds] of byLayer) {
    layerIds.forEach((id, i) => {
      pos.set(id, { x: x0 + l * xGap, y: y0 + i * yGap });
    });
  }
  return pos;
}
