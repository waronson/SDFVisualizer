import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ReactFlowProvider,
    useNodesState,
    useEdgesState,
    addEdge,
} from '@xyflow/react';
import './App.css';
import NodeEditor from './editor/NodeEditor';
import GraphMenu from './editor/GraphMenu';
import Preview from './preview/Preview';
import { compileGraph } from './sdf/compile';
import {
    GraphActionsContext,
    initialGraph,
    makeNode,
    serializeGraph,
    deserializeGraph,
} from './editor/graphConfig';
import { listGraphs, getGraph, createGraph, updateGraph, deleteGraph } from './api/graphs';

const START = initialGraph();

function App() {
    const [nodes, setNodes, onNodesChange] = useNodesState(START.nodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(START.edges);

    // Save/load state.
    const [name, setName] = useState('Untitled');
    const [currentId, setCurrentId] = useState(null);
    const [graphs, setGraphs] = useState([]);
    const [status, setStatus] = useState('');
    const [busy, setBusy] = useState(false);
    const [serverError, setServerError] = useState(false);
    // Bumped on new/open to remount React Flow so it re-runs fitView.
    const [graphKey, setGraphKey] = useState(0);

    const refreshList = useCallback(async () => {
        try {
            setGraphs(await listGraphs());
            setServerError(false);
        } catch {
            setServerError(true);
        }
    }, []);

    // Load the saved-graph list once on mount. State updates happen after the
    // await (not synchronously in the effect), and are ignored if unmounted.
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const list = await listGraphs();
                if (active) {
                    setGraphs(list);
                    setServerError(false);
                }
            } catch {
                if (active) setServerError(true);
            }
        })();
        return () => {
            active = false;
        };
    }, []);

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

    const handleNew = useCallback(() => {
        const g = initialGraph();
        setNodes(g.nodes);
        setEdges(g.edges);
        setCurrentId(null);
        setName('Untitled');
        setStatus('New graph');
        setGraphKey((k) => k + 1);
    }, [setNodes, setEdges]);

    const handleSave = useCallback(async () => {
        setBusy(true);
        setStatus('Saving…');
        try {
            const data = serializeGraph(nodes, edges);
            const summary = currentId
                ? await updateGraph(currentId, name, data)
                : await createGraph(name, data);
            setCurrentId(summary.id);
            setName(summary.name);
            setStatus('Saved');
            setServerError(false);
            await refreshList();
        } catch {
            setServerError(true);
            setStatus('Save failed');
        } finally {
            setBusy(false);
        }
    }, [nodes, edges, currentId, name, refreshList]);

    const handleOpen = useCallback(
        async (id) => {
            setBusy(true);
            setStatus('Loading…');
            try {
                const record = await getGraph(id);
                const g = deserializeGraph(record.data);
                setNodes(g.nodes);
                setEdges(g.edges);
                setCurrentId(record.id);
                setName(record.name);
                setStatus('Loaded');
                setServerError(false);
                setGraphKey((k) => k + 1);
            } catch {
                setServerError(true);
                setStatus('Load failed');
            } finally {
                setBusy(false);
            }
        },
        [setNodes, setEdges],
    );

    const handleDelete = useCallback(
        async (id) => {
            try {
                await deleteGraph(id);
                if (id === currentId) {
                    setCurrentId(null);
                    setStatus('Deleted current graph');
                }
                await refreshList();
            } catch {
                setServerError(true);
            }
        },
        [currentId, refreshList],
    );

    const actions = useMemo(() => ({ setParam, removeNode }), [setParam, removeNode]);

    // Recompile the raymarch map() body whenever the graph changes.
    const mapBody = useMemo(() => compileGraph(nodes, edges), [nodes, edges]);

    const menu = (
        <GraphMenu
            name={name}
            onNameChange={setName}
            onNew={handleNew}
            onSave={handleSave}
            onOpen={handleOpen}
            onDelete={handleDelete}
            graphs={graphs}
            currentId={currentId}
            status={status}
            busy={busy}
            serverError={serverError}
        />
    );

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
                            menuSlot={menu}
                            graphKey={graphKey}
                        />
                    </ReactFlowProvider>
                    <Preview mapBody={mapBody} />
                </div>
            </div>
        </GraphActionsContext.Provider>
    );
}

export default App;
