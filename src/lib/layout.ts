import type { CueEdge, CueNode } from '../types';
import { topoSort } from './schedule';

const COL_GAP = 280;
const ROW_GAP = 150;

/** 基于拓扑层级的简单自动布局，导入后可一键整理 */
export function autoLayout(nodes: CueNode[], edges: CueEdge[]): CueNode[] {
  const order = topoSort(nodes, edges);
  if (!order) return nodes;

  const level = new Map<string, number>();
  for (const id of order) {
    const parents = edges.filter((e) => e.target === id).map((e) => e.source);
    level.set(id, parents.length ? Math.max(...parents.map((p) => (level.get(p) ?? -1) + 1)) : 0);
  }

  const byLevel = new Map<number, string[]>();
  level.forEach((lv, id) => {
    if (!byLevel.has(lv)) byLevel.set(lv, []);
    byLevel.get(lv)!.push(id);
  });

  const pos = new Map<string, { x: number; y: number }>();
  [...byLevel.entries()]
    .sort((a, b) => a[0] - b[0])
    .forEach(([lv, ids]) => {
      ids.sort();
      const h = ids.length;
      ids.forEach((id, row) => {
        pos.set(id, {
          x: 80 + lv * COL_GAP,
          y: 80 + row * ROW_GAP - ((h - 1) * ROW_GAP) / 2 + 240,
        });
      });
    });

  return nodes.map((n) => ({ ...n, position: pos.get(n.id) ?? n.position }));
}
