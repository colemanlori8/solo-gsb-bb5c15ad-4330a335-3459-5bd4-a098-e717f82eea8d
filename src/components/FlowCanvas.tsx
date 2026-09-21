import { useCallback, useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  ControlButton,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type EdgeTypes,
} from '@xyflow/react';
import type { CueNode } from '../types';
import { useGraph } from '../store';
import { CueNodeView } from './CueNodeView';
import { CriticalEdge } from './CriticalEdge';
import { KIND_META } from './meta';

const nodeTypes = { cue: CueNodeView };
const edgeTypes: EdgeTypes = { smoothstep: CriticalEdge, default: CriticalEdge };

export function FlowCanvas() {
  const nodes = useGraph((s) => s.nodes);
  const edges = useGraph((s) => s.edges);
  const schedule = useGraph((s) => s.schedule);
  const onNodesChange = useGraph((s) => s.onNodesChange);
  const onEdgesChange = useGraph((s) => s.onEdgesChange);
  const onConnect = useGraph((s) => s.onConnect);
  const selectCue = useGraph((s) => s.selectCue);
  const selectEdge = useGraph((s) => s.selectEdge);
  const removeEdge = useGraph((s) => s.removeEdge);
  const notify = useGraph((s) => s.notify);
  const doAutoLayout = useGraph((s) => s.autoLayout);

  const criticalSet = useMemo(() => new Set(schedule.criticalEdges), [schedule]);

  // 为边注入关键路径样式（不修改用户数据）
  const styledEdges = useMemo<Edge[]>(
    () =>
      edges.map((e) =>
        criticalSet.has(e.id)
          ? {
              ...e,
              type: 'smoothstep',
              animated: true,
              className: 'edge-critical',
              style: { stroke: '#ff5d73', strokeWidth: 3 },
              label: '关键',
              labelStyle: { fill: '#ff5d73', fontSize: 10, fontWeight: 700 },
              labelBgStyle: { fill: '#1b1020' },
            }
          : { ...e, type: 'smoothstep', className: 'edge-normal' },
      ),
    [edges, criticalSet],
  );

  const onPaneClick = useCallback(() => {
    selectCue(null);
    selectEdge(null);
  }, [selectCue, selectEdge]);

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => selectEdge(edge.id),
    [selectEdge],
  );

  const onEdgeDoubleClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => removeEdge(edge.id),
    [removeEdge],
  );

  const isValidConnection = useCallback(
    (edge: Edge | { source: string; target: string }) => {
      const { source, target } = edge;
      if (source === target) return false;
      const s = useGraph.getState();
      if (s.edges.some((e) => e.source === source && e.target === target)) return false;
      // 连接落定后由 onConnect 做环路拦截并弹出提示
      return true;
    },
    [],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={styledEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onPaneClick={onPaneClick}
      onEdgeClick={onEdgeClick}
      onEdgeDoubleClick={onEdgeDoubleClick}
      isValidConnection={isValidConnection}
      fitView
      minZoom={0.2}
      proOptions={{ hideAttribution: true }}
      defaultEdgeOptions={{ type: 'smoothstep' }}
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#3d3350" />
      <Controls showInteractive={false}>
        <ControlButton onClick={doAutoLayout} title="按依赖层级自动布局">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="6" height="6" rx="1" />
            <rect x="15" y="3" width="6" height="6" rx="1" />
            <rect x="9" y="15" width="6" height="6" rx="1" />
            <path d="M6 9v3h12V9M12 12v3" />
          </svg>
        </ControlButton>
        <ControlButton
          onClick={() => notify('提示：双击连线可删除；悬停节点可在运行表中同步高亮', 'info')}
          title="操作帮助"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5M12 7.5v.5" />
          </svg>
        </ControlButton>
      </Controls>
      <MiniMap
        pannable
        zoomable
        nodeColor={(n) => KIND_META[(n as CueNode).data.kind]?.color ?? '#888'}
        nodeStrokeColor={(n) =>
          schedule.map[n.id]?.critical ? '#ff5d73' : '#241c30'
        }
        maskColor="rgba(13,10,20,0.72)"
        style={{ background: '#15101f' }}
    />
    </ReactFlow>
  );
}
