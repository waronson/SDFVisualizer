import { useCallback, useMemo } from 'react';
import {
    ReactFlowProvider,
    useNodesState,
    useEdgesState,
    addEdge,
} from '@xyflow/react';
import './App.css';
import NodeEditor from './editor/NodeEditor';
import Preview from './preview/Preview';
import { compileGraph } from './sdf/compile';
import { GraphActionsContext, initialGraph, makeNode } from './editor/graphConfig';

const START = initialGraph();

function App() {
    const [nodes, setNodes, onNodesChange] = useNodesState(START.nodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(START.edges);

    // One connection per target handle: drop any existing edge into that slot.
    const onConnect = useCallback(
        (params) => {
            setEdges((eds) =>
                addEdge(
                    params,
                    eds.filter(
                        (e) => !(e.target === params.target && e.targetHandle === params.targetHandle),
                    ),
                ),
            );
        },
        [setEdges],
    );

    const setParam = useCallback(
        (nodeId, key, value) => {
            setNodes((nds) =>
                nds.map((n) =>
                    n.id === nodeId
                        ? { ...n, data: { ...n.data, params: { ...n.data.params, [key]: value } } }
                        : n,
                ),
            );
        },
        [setNodes],
    );

    const removeNode = useCallback(
        (nodeId) => {
            setNodes((nds) => nds.filter((n) => n.id !== nodeId));
            setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
        },
        [setNodes, setEdges],
    );

    const addNode = useCallback(
        (type) => {
            const position = { x: 80 + Math.random() * 120, y: 80 + Math.random() * 160 };
            setNodes((nds) => nds.concat(makeNode(type, position)));
        },
        [setNodes],
    );

    const actions = useMemo(() => ({ setParam, removeNode }), [setParam, removeNode]);

    // Recompile the raymarch map() body whenever the graph changes.
    const mapBody = useMemo(() => compileGraph(nodes, edges), [nodes, edges]);

    return (
        <GraphActionsContext.Provider value={actions}>
            <div className="app">
                <header className="app-header">
                    <h1>SDF Visualizer</h1>
                    <span className="app-sub">
                        node-based signed distance fields · live raymarched preview
                    </span>
                </header>
                <div className="app-body">
                    <ReactFlowProvider>
                        <NodeEditor
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            onAddNode={addNode}
                        />
                    </ReactFlowProvider>
                    <Preview mapBody={mapBody} />
                </div>
            </div>
        </GraphActionsContext.Provider>
    );
}

export default App;
