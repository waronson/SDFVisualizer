import { createContext } from 'react';
import { NODE_DEFS, defaultParams } from '../sdf/nodes';

// Provides node-mutation callbacks to custom node components without threading
// them through React Flow's data on every render.
export const GraphActionsContext = createContext({
    setParam: () => {},
    removeNode: () => {},
});

let idCounter = 0;
// Include a per-session timestamp so ids stay unique even after loading a saved
// graph whose nodes were created in an earlier session.
const session = Date.now().toString(36);
export const newId = (type) => `${type}-${session}-${(idCounter++).toString(36)}`;

// Factory for a graph node of a given SDF type, seeded with default params.
export function makeNode(type, position) {
    const def = NODE_DEFS[type];
    return {
        id: newId(type),
        type: 'sdf',
        position,
        data: { type, params: defaultParams(def) },
    };
}

// Starting scene: a sphere + box smooth-unioned, displaced by noise, on a plane.
export function initialGraph() {
    const sphere = makeNode('sphere', { x: 40, y: 40 });
    const box = makeNode('box', { x: 40, y: 230 });
    const smooth = makeNode('smoothUnion', { x: 320, y: 110 });
    const noise = makeNode('noiseDisplace', { x: 560, y: 110 });
    const plane = makeNode('plane', { x: 320, y: 320 });
    const union = makeNode('union', { x: 780, y: 200 });
    const output = makeNode('output', { x: 1000, y: 200 });

    const nodes = [sphere, box, smooth, noise, plane, union, output];
    const edges = [
        edge(sphere, smooth, 'a'),
        edge(box, smooth, 'b'),
        edge(smooth, noise, 'in'),
        edge(noise, union, 'a'),
        edge(plane, union, 'b'),
        edge(union, output, 'in'),
    ];
    return { nodes, edges };
}

function edge(source, target, targetHandle) {
    return {
        id: `${source.id}->${target.id}:${targetHandle}`,
        source: source.id,
        sourceHandle: 'out',
        target: target.id,
        targetHandle,
    };
}

// Reduce React Flow nodes/edges to the minimal, transient-field-free shape we
// persist (and can faithfully restore).
export function serializeGraph(nodes, edges) {
    return {
        nodes: nodes.map((n) => ({
            id: n.id,
            type: 'sdf',
            position: { x: n.position.x, y: n.position.y },
            data: { type: n.data.type, params: { ...n.data.params } },
        })),
        edges: edges.map((e) => ({
            id: e.id,
            source: e.source,
            sourceHandle: e.sourceHandle ?? 'out',
            target: e.target,
            targetHandle: e.targetHandle ?? 'in',
        })),
    };
}

// Rebuild editor nodes/edges from a stored payload, dropping unknown node types
// and backfilling any params missing from older saves with current defaults.
export function deserializeGraph(data) {
    const rawNodes = Array.isArray(data?.nodes) ? data.nodes : [];
    const rawEdges = Array.isArray(data?.edges) ? data.edges : [];

    const nodes = rawNodes
        .filter((n) => NODE_DEFS[n?.data?.type])
        .map((n) => {
            const def = NODE_DEFS[n.data.type];
            return {
                id: String(n.id),
                type: 'sdf',
                position: { x: Number(n.position?.x) || 0, y: Number(n.position?.y) || 0 },
                data: { type: n.data.type, params: { ...defaultParams(def), ...(n.data.params || {}) } },
            };
        });

    const ids = new Set(nodes.map((n) => n.id));
    const edges = rawEdges
        .filter((e) => e && ids.has(String(e.source)) && ids.has(String(e.target)))
        .map((e) => ({
            id: String(e.id ?? `${e.source}->${e.target}:${e.targetHandle ?? 'in'}`),
            source: String(e.source),
            sourceHandle: e.sourceHandle ?? 'out',
            target: String(e.target),
            targetHandle: e.targetHandle ?? 'in',
        }));

    return { nodes, edges };
}
