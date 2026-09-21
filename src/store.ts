import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import { create } from 'zustand';
import type { CueData, CueEdge, CueKind, CueNode, Notice, ScheduleResult } from './types';
import { computeSchedule, wouldCycle } from './lib/schedule';
import { autoLayout } from './lib/layout';
import { downloadJson, parseGraph, serializeGraph } from './lib/io';
import { createDemo } from './lib/demo';

let seq = 1;
const nextId = (kind: string) => `${kind}_${Date.now().toString(36)}_${seq++}`;

function bakeSchedule(nodes: CueNode[], result: ScheduleResult): CueNode[] {
  return nodes.map((n) => ({
    ...n,
    data: { ...n.data, sched: result.map[n.id] },
  }));
}

interface GraphState {
  nodes: CueNode[];
  edges: CueEdge[];
  schedule: ScheduleResult;
  selectedCueId: string | null;
  selectedEdgeId: string | null;
  hoveredId: string | null;
  notices: Notice[];

  selectCue: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  setHovered: (id: string | null) => void;

  onNodesChange: (changes: NodeChange<CueNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<CueEdge>[]) => void;
  onConnect: (conn: Connection) => void;

  addNode: (kind: CueKind) => void;
  updateCue: (id: string, patch: Partial<Pick<CueData, 'label' | 'duration' | 'delay' | 'kind'>>) => void;
  removeCue: (id: string) => void;
  removeEdge: (id: string) => void;
  clearAll: () => void;
  loadDemo: () => void;
  autoLayout: () => void;
  importJsonText: (text: string) => boolean;
  exportJson: () => void;

  notify: (text: string, tone?: Notice['tone']) => void;
  dismissNotice: (id: number) => void;
}

function commit(
  set: (fn: (s: GraphState) => Partial<GraphState>) => void,
  get: () => GraphState,
  patch: { nodes?: CueNode[]; edges?: CueEdge[] },
) {
  const nodes = patch.nodes ?? get().nodes;
  const edges = patch.edges ?? get().edges;
  const schedule = computeSchedule(nodes, edges);
  set(() => ({
    nodes: bakeSchedule(nodes, schedule),
    edges,
    schedule,
  }));
}

let noticeSeq = 1;

export const useGraph = create<GraphState>((set, get) => {
  const initial = createDemo();
  const initialSchedule = computeSchedule(initial.nodes, initial.edges);

  return {
    nodes: bakeSchedule(initial.nodes, initialSchedule),
    edges: initial.edges,
    schedule: initialSchedule,
    selectedCueId: null,
    selectedEdgeId: null,
    hoveredId: null,
    notices: [],

    selectCue: (id) => set(() => ({ selectedCueId: id, selectedEdgeId: id ? null : get().selectedEdgeId })),
    selectEdge: (id) => set(() => ({ selectedEdgeId: id, selectedCueId: id ? null : get().selectedCueId })),
    setHovered: (id) => set(() => ({ hoveredId: id })),

    onNodesChange: (changes) => {
      const nextNodes = applyNodeChanges(changes, get().nodes) as CueNode[];
      // React Flow 手动接管 onNodesChange 时，删除节点不会自动级联删除连线
      const removed = changes
        .filter((c): c is Extract<NodeChange<CueNode>, { type: 'remove' }> => c.type === 'remove')
        .map((c) => c.id);
      const nextEdges =
        removed.length > 0
          ? get().edges.filter((e) => !removed.includes(e.source) && !removed.includes(e.target))
          : get().edges;
      commit(set, get, { nodes: nextNodes, edges: nextEdges });
      const selectedId = get().selectedCueId;
      if (removed.length > 0 && selectedId && removed.includes(selectedId)) {
        set(() => ({ selectedCueId: null }));
      }
    },

    onEdgesChange: (changes) => {
      const edges = applyEdgeChanges(changes, get().edges) as CueEdge[];
      commit(set, get, { edges });
    },

    onConnect: (conn) => {
      const { source, target } = conn;
      if (!source || !target) return;
      if (source === target) {
        get().notify('不能将节点连接到自身', 'error');
        return;
      }
      if (get().edges.some((e) => e.source === source && e.target === target)) {
        get().notify('该依赖连线已存在', 'error');
        return;
      }
      if (wouldCycle(get().nodes, get().edges, { source, target })) {
        get().notify('连线被阻止：会形成依赖环路', 'error');
        return;
      }
      const edge: CueEdge = {
        id: nextId('edge'),
        source,
        target,
        type: 'smoothstep',
      };
      commit(set, get, { edges: [...get().edges, edge] });
      get().notify('已建立依赖连线', 'success');
    },

    addNode: (kind) => {
      const id = nextId(kind);
      const name = { light: '灯光提示', sound: '音效提示', actor: '演员提示' }[kind];
      const node: CueNode = {
        id,
        type: 'cue',
        position: {
          x: 120 + Math.random() * 480,
          y: 80 + Math.random() * 360,
        },
        data: { label: `${name} ${get().nodes.length + 1}`, kind, duration: 3, delay: 0 },
      };
      commit(set, get, { nodes: [...get().nodes, node] });
      set(() => ({ selectedCueId: id, selectedEdgeId: null }));
    },

    updateCue: (id, patch) => {
      const nodes = get().nodes.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, ...patch, label: patch.label ?? n.data.label } }
          : n,
      );
      commit(set, get, { nodes });
    },

    removeCue: (id) => {
      commit(set, get, {
        nodes: get().nodes.filter((n) => n.id !== id),
        edges: get().edges.filter((e) => e.source !== id && e.target !== id),
      });
      if (get().selectedCueId === id) set(() => ({ selectedCueId: null }));
    },

    removeEdge: (id) => {
      commit(set, get, { edges: get().edges.filter((e) => e.id !== id) });
      if (get().selectedEdgeId === id) set(() => ({ selectedEdgeId: null }));
    },

    clearAll: () => {
      commit(set, get, { nodes: [], edges: [] });
      set(() => ({ selectedCueId: null, selectedEdgeId: null }));
    },

    loadDemo: () => {
      const demo = createDemo();
      commit(set, get, demo);
      set(() => ({ selectedCueId: null, selectedEdgeId: null }));
      get().notify('已载入示例编排', 'success');
    },

    autoLayout: () => {
      if (!get().nodes.length) return;
      commit(set, get, { nodes: autoLayout(get().nodes, get().edges) });
      get().notify('已按依赖层级重新布局', 'success');
    },

    importJsonText: (text) => {
      try {
        const parsed = parseGraph(JSON.parse(text));
        commit(set, get, parsed);
        set(() => ({ selectedCueId: null, selectedEdgeId: null }));
        get().notify(`导入成功：${parsed.nodes.length} 个节点，${parsed.edges.length} 条连线`, 'success');
        return true;
      } catch (err) {
        get().notify(err instanceof Error ? err.message : '导入失败：文件格式无效', 'error');
        return false;
      }
    },

    exportJson: () => {
      downloadJson(serializeGraph(get().nodes, get().edges));
      get().notify('已导出 JSON 文件', 'success');
    },

    notify: (text, tone = 'info') => {
      const id = noticeSeq++;
      set((s) => ({ notices: [...s.notices, { id, text, tone }] }));
      setTimeout(() => get().dismissNotice(id), 3200);
    },
    dismissNotice: (id) =>
      set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
  };
});
