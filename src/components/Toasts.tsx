import { useGraph } from '../store';

export function Toasts() {
  const notices = useGraph((s) => s.notices);
  const dismiss = useGraph((s) => s.dismissNotice);

  return (
    <div className="toasts">
      {notices.map((n) => (
        <div key={n.id} className={`toast toast-${n.tone}`} onClick={() => dismiss(n.id)}>
          <span className="toast-icon">
            {n.tone === 'error' ? '⛔' : n.tone === 'success' ? '✅' : 'ℹ️'}
          </span>
          {n.text}
        </div>
      ))}
    </div>
  );
}
