import { useGraph } from '../store';
import { fmtTime } from './meta';

export function StatusBar() {
  const schedule = useGraph((s) => s.schedule);
  const nodes = useGraph((s) => s.nodes);
  const edges = useGraph((s) => s.edges);

  return (
    <footer className="status-bar">
      <span className={`status-pill ${schedule.cyclic ? 'bad' : 'ok'}`}>
        {schedule.cyclic ? '⛔ 检测到环路' : '✓ 无环'}
      </span>
      <span className="status-item">
        节点 <b>{nodes.length}</b>
      </span>
      <span className="status-item">
        连线 <b>{edges.length}</b>
      </span>
      <span className="status-item makespan">
        总时长 <b>{fmtTime(schedule.makespan)}</b>
      </span>
      <span className="status-item">
        关键节点 <b className="cp">{schedule.criticalPath.length}</b>
      </span>
      <span className="status-spacer" />
      <span className="status-hint">
        拖动节点右侧圆点连线 · 双击连线删除 · 红色加粗为关键路径
      </span>
    </footer>
  );
}
