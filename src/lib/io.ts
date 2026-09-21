import type { CueEdge, CueGraphFile, CueKind, CueNode } from '../types';
import { clampNum } from './schedule';
import { topoSort } from './schedule';

const KINDS: CueKind[] = ['light', 'sound', 'actor'];

/** 序列化为可移植 JSON（不含运行时态） */
export function serializeGraph(nodes: CueNode[], edges: CueEdge[]): CueGraphFile {
  return {
    app: 'stage-cue-chain',
    version: 1,
    nodes: nodes.map((n) => ({
      id: n.id,
      label: String(n.data.label ?? n.id),
      kind: KINDS.includes(n.data.kind) ? n.data.kind : 'light',
      duration: clampNum(n.data.duration),
      delay: clampNum(n.data.delay),
      position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
    })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  };
}

/** 解析并校验导入文件，自动修复/跳过无效数据；含环时抛出错误 */
export function parseGraph(json: unknown): { nodes: CueNode[]; edges: CueEdge[] } {
  if (typeof json !== 'object' || json === null) {
    throw new Error('文件不是有效的 JSON 对象');
  }
  const root = json as Record<string, unknown>;
  if (!Array.isArray(root.nodes) || !Array.isArray(root.edges)) {
    throw new Error('缺少 nodes 或 edges 数组');
  }

  const nodes: CueNode[] = [];
  const seen = new Set<string>();
  root.nodes.forEach((raw, i) => {
    if (typeof raw !== 'object' || raw === null) return;
    const r = raw as Record<string, unknown>;
    const id = typeof r.id === 'string' && r.id.trim() ? r.id.trim() : `cue_${i + 1}`;
    if (seen.has(id)) return; // 重复 id 跳过
    seen.add(id);
    const kind: CueKind = KINDS.includes(r.kind as CueKind) ? (r.kind as CueKind) : 'light';
    const pos =
      typeof r.position === 'object' && r.position !== null
        ? (r.position as Record<string, unknown>)
        : {};
    nodes.push({
      id,
      type: 'cue',
      position: { x: Number(pos.x) || 0, y: Number(pos.y) || 0 },
      data: {
        label: typeof r.label === 'string' && r.label.trim() ? r.label : id,
        kind,
        duration: clampNum(r.duration),
        delay: clampNum(r.delay),
      },
    });
  });

  if (nodes.length === 0) throw new Error('没有可用的节点');

  const ids = new Set(nodes.map((n) => n.id));
  const edgeSet = new Set<string>();
  const edges: CueEdge[] = [];
  root.edges.forEach((raw, i) => {
    if (typeof raw !== 'object' || raw === null) return;
    const r = raw as Record<string, unknown>;
    const source = String(r.source ?? '');
    const target = String(r.target ?? '');
    if (!ids.has(source) || !ids.has(target) || source === target) return;
    const key = `${source}->${target}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    const id = typeof r.id === 'string' && r.id.trim() ? r.id : `edge_${i + 1}`;
    edges.push({ id, source, target, type: 'smoothstep' });
  });

  if (!topoSort(nodes, edges)) {
    throw new Error('导入失败：依赖关系中存在环路，已取消加载');
  }

  return { nodes, edges };
}

export function downloadJson(data: CueGraphFile): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  a.href = url;
  a.download = `cue-chain-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
