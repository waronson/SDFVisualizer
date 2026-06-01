import { createContext } from 'react';
import { NODE_DEFS, defaultParams } from '../sdf/nodes';

// Provides node-mutation callbacks to custom node components without threading
// them through React Flow's data on every render.
export const GraphActionsContext = createContext({
    setParam: () => {},
    removeNode: () => {},
});

let idCounter = 0;
export const newId = (type) => `${type}-${idCounter++}`;

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
