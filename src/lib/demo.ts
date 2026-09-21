import type { CueEdge, CueNode } from '../types';

export function createDemo(): { nodes: CueNode[]; edges: CueEdge[] } {
  const mk = (
    id: string,
    label: string,
    kind: CueNode['data']['kind'],
    duration: number,
    delay: number,
    x: number,
    y: number,
  ): CueNode => ({
    id,
    type: 'cue',
    position: { x, y },
    data: { label, kind, duration, delay },
  });

  const nodes: CueNode[] = [
    mk('cue_open', '开场暗场', 'light', 2, 0, 80, 120),
    mk('cue_music_in', '序曲渐入', 'sound', 12, 0, 80, 320),
    mk('cue_spot', '追光起', 'light', 4, 2, 400, 120),
    mk('cue_lead', '主角登场', 'actor', 6, 1, 400, 320),
    mk('cue_fanfare', '号角音效', 'sound', 3, 0, 720, 120),
    mk('cue_choir', '合唱队上台', 'actor', 8, 2, 720, 320),
    mk('cue_wash', '满场暖光', 'light', 5, 1, 1040, 220),
    mk('cue_curtain', '大幕升起', 'actor', 3, 1, 1360, 220),
  ];

  const edge = (source: string, target: string): CueEdge => ({
    id: `e_${source}_${target}`,
    source,
    target,
    type: 'smoothstep',
  });

  const edges: CueEdge[] = [
    edge('cue_open', 'cue_spot'),
    edge('cue_open', 'cue_lead'),
    edge('cue_music_in', 'cue_lead'),
    edge('cue_spot', 'cue_fanfare'),
    edge('cue_lead', 'cue_choir'),
    edge('cue_fanfare', 'cue_wash'),
    edge('cue_choir', 'cue_wash'),
    edge('cue_wash', 'cue_curtain'),
  ];

  return { nodes, edges };
}
