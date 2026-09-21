export type CueKind = 'light' | 'sound' | 'actor';

export interface CueData {
  /** 提示名称 */
  label: string;
  kind: CueKind;
  /** 持续时间（秒） */
  duration: number;
  /** 相对前置节点完成时刻的延迟（秒） */
  delay: number;
  /** 调度引擎写入的计算结果 */
  sched?: NodeSchedule;
  /** React Flow 内部使用 */
  [key: string]: unknown;
}

export type CueNode = import('@xyflow/react').Node<CueData, 'cue'>;
export type CueEdge = import('@xyflow/react').Edge;

/** 单个节点的调度计算结果 */
export interface NodeSchedule {
  /** 最早触发时刻 earliest start */
  es: number;
  /** 最早完成时刻 earliest finish */
  ef: number;
  /** 最晚触发时刻 latest start */
  ls: number;
  /** 最晚完成时刻 latest finish */
  lf: number;
  /** 机动时间 */
  slack: number;
  /** 是否位于关键路径 */
  critical: boolean;
}

export interface ScheduleResult {
  /** 节点 id -> 调度结果 */
  map: Record<string, NodeSchedule>;
  /** 关键路径上的节点 id，按拓扑顺序 */
  criticalPath: string[];
  /** 关键路径上的边 id */
  criticalEdges: string[];
  /** 全剧总时长（秒） */
  makespan: number;
  /** 是否存在环路（此时 map 为空结果） */
  cyclic: boolean;
  /** 拓扑顺序 */
  order: string[];
}

/** JSON 导入导出文件格式 */
export interface CueGraphFile {
  app: 'stage-cue-chain';
  version: 1;
  nodes: Array<{
    id: string;
    label: string;
    kind: CueKind;
    duration: number;
    delay: number;
    position: { x: number; y: number };
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
  }>;
}

export interface Notice {
  id: number;
  text: string;
  tone: 'info' | 'error' | 'success';
}
