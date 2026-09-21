import type { CueKind } from '../types';
import { useGraph } from '../store';
import { KIND_META, fmtTime } from './meta';

function NumberField(props: {
  label: string;
  unit: string;
  value: number;
  min?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <div className="num-input">
        <input
          type="number"
          min={props.min ?? 0}
          step={props.step ?? 1}
          value={props.value}
          onChange={(e) => {
            const v = Number(e.target.value);
            props.onChange(Number.isFinite(v) && v >= 0 ? v : 0);
          }}
        />
        <em>{props.unit}</em>
      </div>
    </label>
  );
}

export function Inspector() {
  const selectedCueId = useGraph((s) => s.selectedCueId);
  const selectedEdgeId = useGraph((s) => s.selectedEdgeId);
  const nodes = useGraph((s) => s.nodes);
  const edges = useGraph((s) => s.edges);
  const updateCue = useGraph((s) => s.updateCue);
  const removeCue = useGraph((s) => s.removeCue);
  const removeEdge = useGraph((s) => s.removeEdge);

  const node = nodes.find((n) => n.id === selectedCueId) ?? null;
  const edge = !node ? edges.find((e) => e.id === selectedEdgeId) ?? null : null;

  if (!node && !edge) {
    return (
      <aside className="panel inspector inspector-empty">
        <h3>属性检查器</h3>
        <p className="hint">
          点击画布中的节点查看与编辑参数，点击连线查看依赖关系。
        </p>
        <ul className="legend">
          <li>💡 <b>灯光</b>：灯位、光色变化</li>
          <li>🔊 <b>音效</b>：音乐与音效播放</li>
          <li>🎭 <b>演员</b>：走位、上下场提示</li>
        </ul>
        <p className="hint">
          从节点右侧圆点拖出连线，建立「完成 → 触发」依赖。
          系统会阻止形成环路的连线。
        </p>
      </aside>
    );
  }

  if (edge) {
    const src = nodes.find((n) => n.id === edge.source);
    const dst = nodes.find((n) => n.id === edge.target);
    return (
      <aside className="panel inspector">
        <h3>依赖连线</h3>
        <div className="edge-detail">
          <div className="edge-end">{src?.data.label ?? edge.source}</div>
          <div className="edge-arrow">完成后触发 ▸</div>
          <div className="edge-end">{dst?.data.label ?? edge.target}</div>
          <p className="hint">
            目标节点会在前置节点完成后，再等待其自身「相对延迟」秒触发。
          </p>
          <button className="btn btn-danger" onClick={() => removeEdge(edge.id)}>
            删除此连线
          </button>
          <p className="hint dim">提示：在画布上双击连线也可快速删除。</p>
        </div>
      </aside>
    );
  }

  const d = node!.data;
  const meta = KIND_META[d.kind];
  const sched = d.sched;

  return (
    <aside className="panel inspector">
      <h3>
        <span className="dot" style={{ background: meta.color }} />
        属性检查器
      </h3>

      <label className="field">
        <span>提示名称</span>
        <input
          type="text"
          value={d.label}
          onChange={(e) => updateCue(node!.id, { label: e.target.value })}
        />
      </label>

      <div className="field">
        <span>类型</span>
        <div className="kind-switch">
          {(Object.keys(KIND_META) as CueKind[]).map((k) => (
            <button
              key={k}
              className={d.kind === k ? 'active' : ''}
              style={d.kind === k ? { ['--kind' as string]: KIND_META[k].color } : undefined}
              onClick={() => updateCue(node!.id, { kind: k })}
            >
              {KIND_META[k].icon} {KIND_META[k].label}
            </button>
          ))}
        </div>
      </div>

      <div className="field-grid">
        <NumberField
          label="持续时间"
          unit="秒"
          step={0.5}
          value={d.duration}
          onChange={(v) => updateCue(node!.id, { duration: v })}
        />
        <NumberField
          label="相对延迟"
          unit="秒"
          step={0.5}
          value={d.delay}
          onChange={(v) => updateCue(node!.id, { delay: v })}
        />
      </div>

      {sched && (
        <div className={`sched-card ${sched.critical ? 'is-critical' : ''}`}>
          <div className="sched-title">
            {sched.critical ? '⭐ 关键路径节点' : '调度结果'}
          </div>
          <div className="sched-grid">
            <div><span>最早触发</span><b>{fmtTime(sched.es)}</b></div>
            <div><span>最早完成</span><b>{fmtTime(sched.ef)}</b></div>
            <div><span>最晚触发</span><b>{fmtTime(sched.ls)}</b></div>
            <div><span>最晚完成</span><b>{fmtTime(sched.lf)}</b></div>
            <div className="wide"><span>机动时间</span><b>{fmtTime(sched.slack)}</b></div>
          </div>
        </div>
      )}

      <button className="btn btn-danger" onClick={() => removeCue(node!.id)}>
        删除此节点（同时移除相关连线）
      </button>
    </aside>
  );
}
