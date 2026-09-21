import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { CueNode, type CueFlowNode } from './components/CueNode';
import { Inspector } from './components/Inspector';
import { RunTable } from './components/RunTable';
import { Toolbar } from './components/Toolbar';
import { parseShow, serializeShow } from './lib/io';
import { computeSchedule, layeredLayout, wouldCreateCycle } from './lib/schedule';
import { uid } from './lib/uid';
import { createSampleShow } from './sample';
import { CUE_TYPE_META, type CueNodeData, type CueType } from './types';

const nodeTypes = { cue: CueNode };

const EDGE_STYLE = { stroke: '#5b6b8c', strokeWidth: 1.6 };
const EDGE_STYLE_CRITICAL = { stroke: '#ff5a5a', strokeWidth: 2.6 };

const sample = createSampleShow();

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState<CueFlowNode>(sample.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(sample.edges);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const rfInstance = useRef<ReactFlowInstance<CueFlowNode, Edge> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  // 任一节点 / 连线变更后，按依赖重算最早触发时刻与关键路径
  const schedule = useMemo(() => computeSchedule(nodes, edges), [nodes, edges]);

  // 注入计算结果（最早触发时刻、是否关键）供节点渲染
  const displayNodes = useMemo<CueFlowNode[]>(
    () =>
      nodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          earliestStart: schedule.byId.get(n.id)?.earliestStart,
          critical: schedule.criticalNodeIds.has(n.id),
        },
      })),
    [nodes, schedule],
  );

  const displayEdges = useMemo<Edge[]>(
    () =>
      edges.map((e) => {
        const critical = schedule.criticalEdgeIds.has(e.id);
        return {
          ...e,
          animated: critical,
          style: critical ? EDGE_STYLE_CRITICAL : EDGE_STYLE,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: critical ? '#ff5a5a' : '#5b6b8c',
          },
        };
      }),
    [edges, schedule],
  );

  // ---- 连线：阻止成环 ----
  const onConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) return;
      if (wouldCreateCycle(edges, conn.source, conn.target)) {
        showToast('无法连接：该连线会形成环路');
        return;
      }
      setEdges((eds) =>
        addEdge({ ...conn, id: uid('e'), markerEnd: { type: MarkerType.ArrowClosed } }, eds),
      );
    },
    [edges, setEdges, showToast],
  );
  const isValidConnection = useCallback(
    (conn: Edge | Connection) => {
      if (!conn.source || !conn.target) return false;
      return !wouldCreateCycle(edges, conn.source, conn.target);
    },
    [edges],
  );

  // ---- 节点操作 ----
  const addCue = useCallback(
    (type: CueType) => {
      const id = uid('cue');
      const node: CueFlowNode = {
        id,
        type: 'cue',
        position: { x: 120 + (nodes.length % 5) * 36, y: 120 + (nodes.length % 6) * 30 },
        data: {
          label: `${CUE_TYPE_META[type].label}提示 ${nodes.length + 1}`,
          cueType: type,
          duration: 3,
          delay: 0,
        },
        selected: true,
      };
      setNodes((nds) => [...nds.map((n): CueFlowNode => ({ ...n, selected: false })), node]);
      setSelectedId(id);
    },
    [nodes.length, setNodes],
  );

  const updateCue = useCallback(
    (id: string, patch: Partial<CueNodeData>) => {
      setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
    },
    [setNodes],
  );

  const deleteCue = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      setSelectedId((sel) => (sel === id ? null : sel));
    },
    [setNodes, setEdges],
  );

  const selectNode = useCallback(
    (id: string) => {
      setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === id })));
      setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
      setSelectedId(id);
    },
    [setNodes, setEdges],
  );

  const autoLayout = useCallback(() => {
    const pos = layeredLayout(nodes, edges);
    setNodes((nds) => nds.map((n) => ({ ...n, position: pos.get(n.id) ?? n.position })));
    window.requestAnimationFrame(() => rfInstance.current?.fitView({ padding: 0.2, duration: 300 }));
  }, [nodes, edges, setNodes]);

  const clearAll = useCallback(() => {
    if (nodes.length === 0) return;
    if (!window.confirm('确定清空全部节点与连线？')) return;
    setNodes([]);
    setEdges([]);
    setSelectedId(null);
  }, [nodes.length, setNodes, setEdges]);

  // ---- JSON 导入 / 导出 ----
  const exportJson = useCallback(() => {
    const text = serializeShow(nodes, edges);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cue-show.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('已导出 JSON 文件');
  }, [nodes, edges, showToast]);

  const importJson = useCallback(
    async (file: File) => {
      const text = await file.text();
      const res = parseShow(text);
      if (!res.ok) {
        showToast(`导入失败：${res.error}`);
        return;
      }
      setNodes(
        res.nodes.map((n) => ({
          id: n.id,
          type: 'cue' as const,
          position: n.position,
          data: { label: n.label, cueType: n.cueType, duration: n.duration, delay: n.delay },
          selected: false,
        })),
      );
      setEdges(
        res.edges.map((e) => ({
          ...e,
          markerEnd: { type: MarkerType.ArrowClosed },
        })),
      );
      setSelectedId(null);
      showToast(`已导入 ${res.nodes.length} 个节点、${res.edges.length} 条连线`);
      window.requestAnimationFrame(() => rfInstance.current?.fitView({ padding: 0.2 }));
    },
    [setNodes, setEdges, showToast],
  );

  const selectedNode = useMemo(
    () => displayNodes.find((n) => n.id === selectedId) ?? null,
    [displayNodes, selectedId],
  );

  return (
    <div className="app">
      <Toolbar
        totalDuration={schedule.totalDuration}
        criticalCount={schedule.criticalNodeIds.size}
        nodeCount={nodes.length}
        onAdd={addCue}
        onAutoLayout={autoLayout}
        onExport={exportJson}
        onImportFile={(f) => void importJson(f)}
        onClear={clearAll}
      />
      <div className="main">
        <div className="canvas-wrap">
          <ReactFlow
            nodes={displayNodes}
            edges={displayEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={isValidConnection}
            onSelectionChange={({ nodes: sel }) => setSelectedId(sel.length > 0 ? sel[0].id : null)}
            onInit={(inst) => {
              rfInstance.current = inst;
            }}
            deleteKeyCode={['Backspace', 'Delete']}
            fitView
            minZoom={0.2}
            maxZoom={2}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="#2c3852" />
            <Controls position="bottom-left" />
            <MiniMap
              pannable
              zoomable
              nodeColor={(n) =>
                n.data?.critical ? '#ff5a5a' : { lighting: '#e8a13a', sound: '#3fa9f5', actor: '#c678dd' }[(n as CueFlowNode).data.cueType]
              }
            />
          </ReactFlow>
          {schedule.hasCycle ? (
            <div className="banner-error">检测到环路：调度结果可能不准确，请检查连线。</div>
          ) : null}
          {toast ? <div className="toast">{toast}</div> : null}
        </div>
        <aside className="sidebar">
          <Inspector
            node={selectedNode}
            schedule={selectedId ? schedule.byId.get(selectedId) ?? null : null}
            onChange={updateCue}
            onDelete={deleteCue}
          />
          <RunTable nodes={displayNodes} schedule={schedule} selectedId={selectedId} onSelect={selectNode} />
        </aside>
      </div>
    </div>
  );
}
