import { useEffect, useMemo, useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useGraph } from '../store';
import { KIND_META, KIND_ORDER, fmtTime } from './meta';
import type { CueKind } from '../types';

type SortKey = 'order' | 'label' | 'kind' | 'es' | 'ef' | 'duration' | 'delay' | 'slack';
type SortDir = 'asc' | 'desc';

const HEADERS: Array<{ key: SortKey; title: string; numeric?: boolean }> = [
  { key: 'order', title: '#' },
  { key: 'es', title: '触发时刻', numeric: true },
  { key: 'label', title: '提示名称' },
  { key: 'kind', title: '类型' },
  { key: 'duration', title: '持续', numeric: true },
  { key: 'delay', title: '延迟', numeric: true },
  { key: 'ef', title: '完成', numeric: true },
  { key: 'slack', title: '机动', numeric: true },
];

export function RunSheet() {
  const nodes = useGraph((s) => s.nodes);
  const schedule = useGraph((s) => s.schedule);
  const selectedCueId = useGraph((s) => s.selectedCueId);
  const hoveredId = useGraph((s) => s.hoveredId);
  const selectCue = useGraph((s) => s.selectCue);
  const setHovered = useGraph((s) => s.setHovered);
  const instance = useReactFlow();

  const [sortKey, setSortKey] = useState<SortKey>('es');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const topoIndex = useMemo(() => {
    const m = new Map<string, number>();
    schedule.order.forEach((id, i) => m.set(id, i));
    return m;
  }, [schedule.order]);

  const rows = useMemo(() => {
    const list = [...nodes];
    const value = (id: string, key: SortKey): number | string => {
      const n = nodes.find((x) => x.id === id)!;
      switch (key) {
        case 'order': return topoIndex.get(id) ?? 0;
        case 'label': return n.data.label;
        case 'kind': return KIND_ORDER[n.data.kind];
        case 'duration': return n.data.duration;
        case 'delay': return n.data.delay;
        default: return n.data.sched?.[key] ?? 0; // es / ef / slack
      }
    };
    list.sort((a, b) => {
      const va = value(a.id, sortKey);
      const vb = value(b.id, sortKey);
      const cmp =
        typeof va === 'string'
          ? va.localeCompare(String(vb), 'zh-CN')
          : (va as number) - (vb as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [nodes, sortKey, sortDir, topoIndex]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'label' ? 'asc' : 'asc');
    }
  };

  const focusNode = (id: string) => {
    selectCue(id);
    const n = useGraph.getState().nodes.find((x) => x.id === id);
    if (n) instance.setCenter(n.position.x + 110, n.position.y + 55, { duration: 400, zoom: 1.1 });
  };

  // 选中项变化时滚动到可见行
  useEffect(() => {
    if (selectedCueId && rowRefs.current[selectedCueId]) {
      rowRefs.current[selectedCueId]!.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedCueId, sortKey, sortDir]);

  return (
    <section className="panel run-sheet">
      <header className="sheet-head">
        <h3>运行表</h3>
        <span className="sheet-meta">
          {nodes.length} 条提示 · 点击表头排序 · 当前按
          <b>{HEADERS.find((h) => h.key === sortKey)?.title}</b>
          {sortDir === 'asc' ? '升序' : '降序'}
        </span>
      </header>

      <div className="sheet-scroll">
        <table>
          <thead>
            <tr>
              {HEADERS.map((h) => (
                <th
                  key={h.key}
                  className={[
                    h.numeric ? 'num' : '',
                    sortKey === h.key ? 'sorted' : '',
                  ].join(' ')}
                  onClick={() => toggleSort(h.key)}
                  title={`按${h.title}排序`}
                >
                  {h.title}
                  {sortKey === h.key && <span className="sort-arrow">{sortDir === 'asc' ? '▲' : '▼'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((n) => {
              const sched = n.data.sched;
              const meta = KIND_META[n.data.kind as CueKind] ?? KIND_META.light;
              const active = selectedCueId === n.id;
              const hover = hoveredId === n.id;
              return (
                <tr
                  key={n.id}
                  ref={(el) => {
                    rowRefs.current[n.id] = el;
                  }}
                  className={[
                    sched?.critical ? 'critical' : '',
                    active ? 'active' : '',
                    hover ? 'hover' : '',
                  ].join(' ')}
                  style={{ ['--row' as string]: meta.color }}
                  onClick={() => focusNode(n.id)}
                  onMouseEnter={() => setHovered(n.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <td className="num dim">{(topoIndex.get(n.id) ?? 0) + 1}</td>
                  <td className="num strong">{sched ? fmtTime(sched.es) : '—'}</td>
                  <td className="name">
                    <span className="chip" style={{ background: meta.color }}>{meta.icon}</span>
                    {n.data.label}
                    {sched?.critical && <span className="star">★</span>}
                  </td>
                  <td>{meta.label}</td>
                  <td className="num">{fmtTime(n.data.duration)}</td>
                  <td className="num dim">{n.data.delay > 0 ? `+${fmtTime(n.data.delay)}` : '—'}</td>
                  <td className="num dim">{sched ? fmtTime(sched.ef) : '—'}</td>
                  <td className={`num ${sched && sched.slack > 0.001 ? '' : 'slack-zero'}`}>
                    {sched ? fmtTime(sched.slack) : '—'}
                  </td>
                </tr>
              );
            })}
            {nodes.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-row">
                  画布为空 —— 使用左上角工具栏添加提示节点
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {schedule.criticalPath.length > 0 && (
        <footer className="sheet-foot">
          <span className="cp-label">⭐ 关键路径</span>
          <div className="cp-chain">
            {schedule.criticalPath.map((id, i) => {
              const n = nodes.find((x) => x.id === id);
              return (
                <span key={id}>
                  <button
                    className={selectedCueId === id ? 'active' : ''}
                    onClick={() => focusNode(id)}
                    onMouseEnter={() => setHovered(id)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    {n?.data.label ?? id}
                  </button>
                  {i < schedule.criticalPath.length - 1 && <i>▸</i>}
                </span>
              );
            })}
          </div>
        </footer>
      )}
    </section>
  );
}
