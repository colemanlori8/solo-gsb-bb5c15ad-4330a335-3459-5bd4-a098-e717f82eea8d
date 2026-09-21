import { useRef } from 'react';
import { useGraph } from '../store';
import { KIND_META } from './meta';
import type { CueKind } from '../types';

export function Toolbar() {
  const addNode = useGraph((s) => s.addNode);
  const clearAll = useGraph((s) => s.clearAll);
  const loadDemo = useGraph((s) => s.loadDemo);
  const autoLayout = useGraph((s) => s.autoLayout);
  const exportJson = useGraph((s) => s.exportJson);
  const importJsonText = useGraph((s) => s.importJsonText);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    importJsonText(text);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <header className="toolbar">
      <div className="brand">
        <span className="brand-mark">🎬</span>
        <div className="brand-text">
          <b>舞台提示链</b>
          <small>Stage Cue Chain</small>
        </div>
      </div>

      <div className="tool-group">
        <span className="tool-label">添加</span>
        {(Object.keys(KIND_META) as CueKind[]).map((k) => (
          <button key={k} className="btn btn-add" onClick={() => addNode(k)}
            style={{ ['--kind' as string]: KIND_META[k].color }}>
            {KIND_META[k].icon} {KIND_META[k].label}
          </button>
        ))}
      </div>

      <div className="tool-sep" />

      <div className="tool-group">
        <button className="btn" onClick={autoLayout}>⌗ 自动布局</button>
        <button className="btn" onClick={loadDemo}>↺ 示例</button>
        <button className="btn" onClick={exportJson}>⇩ 导出 JSON</button>
        <button className="btn" onClick={() => fileRef.current?.click()}>⇧ 导入 JSON</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>

      <div className="tool-sep" />

      <button className="btn btn-ghost-danger" onClick={() => {
        if (confirm('确定清空整个画布？此操作不可撤销。')) clearAll();
      }}>
        ✕ 清空
      </button>
    </header>
  );
}
