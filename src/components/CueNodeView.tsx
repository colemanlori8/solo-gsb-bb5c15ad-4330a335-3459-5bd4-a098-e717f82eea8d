import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { CueNode } from '../types';
import { KIND_META, fmtTime } from './meta';
import { useGraph } from '../store';

export function CueNodeView({ id, data, selected }: NodeProps<CueNode>) {
  const hoveredId = useGraph((s) => s.hoveredId);
  const selectedCueId = useGraph((s) => s.selectedCueId);
  const setHovered = useGraph((s) => s.setHovered);
  const selectCue = useGraph((s) => s.selectCue);

  const meta = KIND_META[data.kind] ?? KIND_META.light;
  const sched = data.sched;
  const critical = sched?.critical ?? false;
  const active = selected || selectedCueId === id || hoveredId === id;

  return (
    <div
      className={`cue-node ${critical ? 'is-critical' : ''} ${active ? 'is-active' : ''}`}
      style={{ ['--kind' as string]: meta.color, ['--kind-soft' as string]: meta.soft }}
      onMouseEnter={() => setHovered(id)}
      onMouseLeave={() => setHovered(null)}
      onClick={() => selectCue(id)}
    >
      <Handle type="target" position={Position.Left} />
      <div className="cue-head">
        <span className="cue-icon">{meta.icon}</span>
        <span className="cue-label" title={data.label}>
          {data.label}
        </span>
        {critical && <span className="cue-badge">关键</span>}
      </div>
      <div className="cue-times">
        <div className="cue-time-row">
          <span>触发</span>
          <strong>{sched ? fmtTime(sched.es) : '—'}</strong>
        </div>
        <div className="cue-time-row">
          <span>时长</span>
          <strong>{fmtTime(Number(data.duration) || 0)}</strong>
        </div>
        {Number(data.delay) > 0 && (
          <div className="cue-time-row cue-delay">
            <span>延迟</span>
            <strong>+{fmtTime(Number(data.delay))}</strong>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
