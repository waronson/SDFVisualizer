import { useMemo } from 'react';
import { ReactFlow, Background, Controls } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import SdfNode from './SdfNode';
import { NODE_DEFS } from '../sdf/nodes';

const nodeTypes = { sdf: SdfNode };

// Palette grouped by category, excluding the singleton Output node.
const PALETTE = Object.entries(NODE_DEFS)
    .filter(([, def]) => !def.isOutput)
    .reduce((acc, [type, def]) => {
        (acc[def.category] ||= []).push({ type, label: def.label });
        return acc;
    }, {});

// Left panel: the graph canvas plus a toolbar for adding nodes.
export default function NodeEditor({ nodes, edges, onNodesChange, onEdgesChange, onConnect, onAddNode }) {
    const palette = useMemo(() => Object.entries(PALETTE), []);

    return (
        <div className="editor">
            <div className="palette">
                {palette.map(([category, items]) => (
                    <div className="palette-group" key={category}>
                        <span className="palette-label">{category}</span>
                        {items.map((item) => (
                            <button
                                key={item.type}
                                className="palette-btn"
                                onClick={() => onAddNode(item.type)}
                            >
                                + {item.label}
                            </button>
                        ))}
                    </div>
                ))}
            </div>
            <div className="editor-canvas">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    nodeTypes={nodeTypes}
                    fitView
                    proOptions={{ hideAttribution: true }}
                    defaultEdgeOptions={{ animated: true }}
                >
                    <Background gap={18} size={1} color="#2a2d3a" />
                    <Controls showInteractive={false} />
                </ReactFlow>
            </div>
        </div>
    );
}
