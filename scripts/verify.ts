import { computeSchedule, hasCycle, topoSort, wouldCycle } from '../src/lib/schedule';
import { parseGraph, serializeGraph } from '../src/lib/io';
import type { CueEdge, CueNode } from '../src/types';

let failures = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name} ${detail}`);
  }
}
function approx(a: number, b: number) {
  return Math.abs(a - b) < 1e-6;
}

const mkNode = (id: string, duration: number, delay = 0): CueNode => ({
  id,
  type: 'cue',
  position: { x: 0, y: 0 },
  data: { label: id, kind: 'light', duration, delay },
});
const mkEdge = (s: string, t: string): CueEdge => ({ id: `${s}-${t}`, source: s, target: t });

// 场景1：线性链 A(2) -> B(dur3,delay1) -> C(dur4,delay0)
{
  const nodes = [mkNode('A', 2), mkNode('B', 3, 1), mkNode('C', 4)];
  const edges = [mkEdge('A', 'B'), mkEdge('B', 'C')];
  const r = computeSchedule(nodes, edges);
  console.log('场景1 线性链:');
  check('无环', !r.cyclic);
  check('A.es=0', approx(r.map.A.es, 0));
  check('B.es = EF(A)+delay = 2+1 = 3', approx(r.map.B.es, 3), `got ${r.map.B.es}`);
  check('C.es = EF(B)+0 = 6', approx(r.map.C.es, 6), `got ${r.map.C.es}`);
  check('makespan = EF(C) = 10', approx(r.makespan, 10), `got ${r.makespan}`);
  check('全部关键', r.map.A.critical && r.map.B.critical && r.map.C.critical);
  check('关键路径 A->B->C', r.criticalPath.join() === 'A,B,C', r.criticalPath.join());
}

// 场景2：菱形 + 非关键分支
// START(dur2) -> FAST(dur1,delay0) -> END(dur1)
//              -> SLOW(dur6,delay0) -> END
{
  const nodes = [mkNode('START', 2), mkNode('FAST', 1), mkNode('SLOW', 6), mkNode('END', 1)];
  const edges = [mkEdge('START', 'FAST'), mkEdge('START', 'SLOW'), mkEdge('FAST', 'END'), mkEdge('SLOW', 'END')];
  const r = computeSchedule(nodes, edges);
  console.log('场景2 菱形汇聚:');
  check('FAST.es=2', approx(r.map.FAST.es, 2));
  check('SLOW.es=2', approx(r.map.SLOW.es, 2));
  check('END.es = EF(SLOW) = 8（取 max）', approx(r.map.END.es, 8), `got ${r.map.END.es}`);
  check('makespan=9', approx(r.makespan, 9), `got ${r.makespan}`);
  check('FAST 非关键 slack=5', approx(r.map.FAST.slack, 5), `got ${r.map.FAST.slack}`);
  check('SLOW 关键', r.map.SLOW.critical);
  check('关键路径 START-SLOW-END', r.criticalPath.join() === 'START,SLOW,END', r.criticalPath.join());
  check('关键边不含 FAST->END', !r.criticalEdges.includes('FAST-END'));
  check('关键边含 SLOW->END', r.criticalEdges.includes('SLOW-END'));
}

// 场景3：环检测
{
  const nodes = [mkNode('A', 1), mkNode('B', 1), mkNode('C', 1)];
  const edges = [mkEdge('A', 'B'), mkEdge('B', 'C'), mkEdge('C', 'A')];
  console.log('场景3 环路:');
  check('hasCycle=true', hasCycle(nodes, edges));
  check('topoSort=null', topoSort(nodes, edges) === null);
  check('compute cyclic=true', computeSchedule(nodes, edges).cyclic);
  const acyclicEdges = [mkEdge('A', 'B'), mkEdge('B', 'C')];
  check('wouldCycle 拒绝 C->A 回边', wouldCycle(nodes, acyclicEdges, { source: 'C', target: 'A' }));
  check('wouldCycle 拒绝自连', wouldCycle(nodes, [], { source: 'A', target: 'A' }));
  check('wouldCycle 允许 A->C', !wouldCycle(nodes, acyclicEdges, { source: 'A', target: 'C' }));
}

// 场景4：孤立节点（无前置：相对开场延迟）
{
  const nodes = [mkNode('SOLO', 5, 3)];
  const r = computeSchedule(nodes, []);
  console.log('场景4 孤立节点:');
  check('es=delay=3', approx(r.map.SOLO.es, 3), `got ${r.map.SOLO.es}`);
  check('makespan=8', approx(r.makespan, 8));
}

// 场景5：导入导出往返
{
  console.log('场景5 JSON 往返:');
  const nodes = [mkNode('A', 2), mkNode('B', 3)];
  nodes[1].position = { x: 100, y: 200 };
  const edges = [mkEdge('A', 'B')];
  const file = serializeGraph(nodes, edges);
  const text = JSON.stringify(file);
  const back = parseGraph(JSON.parse(text));
  check('节点数一致', back.nodes.length === 2);
  check('边一致', back.edges.length === 1 && back.edges[0].source === 'A');
  check('位置保留', back.nodes[1].position.x === 100);
}

// 场景6：脏数据导入被修复
{
  console.log('场景6 脏数据修复:');
  const dirty = {
    app: 'stage-cue-chain',
    version: 1,
    nodes: [
      { id: 'a', label: 'A', kind: 'BOGUS', duration: -5, delay: 1, position: { x: 1, y: 2 } },
      { id: 'a', label: 'dup' },
      null,
      { label: '无id节点' },
    ],
    edges: [
      { source: 'a', target: 'ghost' },
      { source: 'a', target: 'a' },
      null,
    ],
  };
  const r = parseGraph(dirty);
  check('保留2个节点（去重+null跳过）', r.nodes.length === 2, `got ${r.nodes.length}`);
  check('非法 kind 回退 light', r.nodes[0].data.kind === 'light');
  check('负 duration 归零', r.nodes[0].data.duration === 0);
  check('无效边全部剔除', r.edges.length === 0);
}

// 场景7：含环文件拒绝导入
{
  console.log('场景7 环文件拒绝:');
  let threw = false;
  try {
    parseGraph({
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [{ source: 'a', target: 'b' }, { source: 'b', target: 'a' }],
    });
  } catch {
    threw = true;
  }
  check('抛出错误', threw);
}

console.log(failures === 0 ? '\n全部通过 ✅' : `\n${failures} 项失败 ❌`);
process.exit(failures === 0 ? 0 : 1);
