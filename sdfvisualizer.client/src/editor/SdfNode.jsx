import { memo, useContext } from 'react';
import { Handle, Position } from '@xyflow/react';
import { NODE_DEFS } from '../sdf/nodes';
import { GraphActionsContext } from './graphConfig';

const CATEGORY_CLASS = {
    Primitive: 'cat-primitive',
    Combine: 'cat-combine',
    Transform: 'cat-transform',
    Distort: 'cat-distort',
    Output: 'cat-output',
};

// Custom React Flow node: renders typed input handles, an output handle, and a
// slider per editable parameter. Param edits flow up through the context.
function SdfNode({ id, data }) {
    const def = NODE_DEFS[data.type];
    const { setParam, removeNode } = useContext(GraphActionsContext);

    return (
        <div className={`sdf-node ${CATEGORY_CLASS[def.category] || ''}`}>
            <div className="sdf-node-header">
                <span>{def.label}</span>
                {!def.isOutput && (
                    <button
                        className="sdf-node-remove"
                        title="Delete node"
                        onClick={() => removeNode(id)}
                    >
                        ×
                    </button>
                )}
            </div>

            {def.inputs.map((handleId, i) => (
                <div className="sdf-port sdf-port-in" key={handleId} style={{ top: 38 + i * 20 }}>
                    <Handle
                        type="target"
                        position={Position.Left}
                        id={handleId}
                        className="sdf-handle"
                    />
                    {def.inputs.length > 1 && <span className="sdf-port-label">{handleId}</span>}
                </div>
            ))}

            {!def.isOutput && (
                <Handle
                    type="source"
                    position={Position.Right}
                    id="out"
                    className="sdf-handle sdf-handle-out"
                />
            )}

            {def.params.length > 0 && (
                <div className="sdf-node-body">
                    {def.params.map((p) => (
                        <label className="sdf-param" key={p.key}>
                            <span className="sdf-param-name">{p.label}</span>
                            <input
                                className="sdf-param-slider nodrag"
                                type="range"
                                min={p.min}
                                max={p.max}
                                step={p.step}
                                value={data.params[p.key]}
                                onChange={(e) => setParam(id, p.key, parseFloat(e.target.value))}
                            />
                            <span className="sdf-param-value">
                                {Number(data.params[p.key]).toFixed(2)}
                            </span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
}

export default memo(SdfNode);
