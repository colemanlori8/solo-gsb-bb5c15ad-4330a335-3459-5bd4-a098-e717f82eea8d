import type { Edge } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';
import type { CueFlowNode } from './components/CueNode';
import { layeredLayout } from './lib/schedule';
import type { CueType } from './types';

interface SampleNode {
  id: string;
  label: string;
  cueType: CueType;
  duration: number;
  delay: number;
}

const SAMPLE_NODES: SampleNode[] = [
  { id: 'n1', label: '开场暖场光', cueType: 'lighting', duration: 4, delay: 0 },
  { id: 'n2', label: '开场音乐', cueType: 'sound', duration: 6, delay: 0 },
  { id: 'n3', label: '主持人上场', cueType: 'actor', duration: 3, delay: 1 },
  { id: 'n4', label: '追光定位', cueType: 'lighting', duration: 5, delay: 0 },
  { id: 'n5', label: '掌声音效', cueType: 'sound', duration: 2, delay: 0 },
  { id: 'n6', label: '全体谢幕', cueType: 'actor', duration: 4, delay: 2 },
];

const SAMPLE_EDGES: Array<[string, string]> = [
  ['n1', 'n3'],
  ['n2', 'n3'],
  ['n3', 'n4'],
  ['n3', 'n5'],
  ['n4', 'n6'],
  ['n5', 'n6'],
];

/** 内置示例演出：含并行分支，便于演示关键路径高亮 */
export function createSampleShow(): { nodes: CueFlowNode[]; edges: Edge[] } {
  const edges: Edge[] = SAMPLE_EDGES.map(([source, target]) => ({
    id: `e-${source}-${target}`,
    source,
    target,
    markerEnd: { type: MarkerType.ArrowClosed },
  }));
  const pos = layeredLayout(SAMPLE_NODES, edges);
  const nodes: CueFlowNode[] = SAMPLE_NODES.map((n) => ({
    id: n.id,
    type: 'cue',
    position: pos.get(n.id) ?? { x: 0, y: 0 },
    data: { label: n.label, cueType: n.cueType, duration: n.duration, delay: n.delay },
  }));
  return { nodes, edges };
}
