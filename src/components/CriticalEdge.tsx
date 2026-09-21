import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';

/** 统一走平滑折线；关键路径样式（描边/动画/标签）由 className/style 注入 */
export function CriticalEdge(props: EdgeProps & { className?: string }) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
    borderRadius: 10,
  });

  const label = typeof props.label === 'string' ? props.label : null;

  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        style={props.style}
        className={props.className}
        markerEnd={props.markerEnd}
        interactionWidth={18}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="edge-label"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
