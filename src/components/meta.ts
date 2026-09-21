import type { CueKind } from '../types';

export const KIND_META: Record<CueKind, { label: string; icon: string; color: string; soft: string }> = {
  light: { label: '灯光', icon: '💡', color: '#f5b83d', soft: 'rgba(245,184,61,0.14)' },
  sound: { label: '音效', icon: '🔊', color: '#4fc3f7', soft: 'rgba(79,195,247,0.14)' },
  actor: { label: '演员', icon: '🎭', color: '#f0729b', soft: 'rgba(240,114,155,0.14)' },
};

export const KIND_ORDER: Record<CueKind, number> = { light: 0, sound: 1, actor: 2 };

/** 秒 -> m:ss / s（支持 0.5 秒精度输入产生的小数） */
export function fmtTime(sec: number): string {
  const n = Math.max(0, sec);
  const m = Math.floor(n / 60);
  const rest = n - m * 60;
  if (m === 0) return `${n.toFixed(n % 1 === 0 ? 0 : 1)}s`;
  const [int, dec] = rest.toFixed(1).split('.');
  return `${m}:${int.padStart(2, '0')}${dec !== '0' ? `.${dec}` : ''}`;
}
