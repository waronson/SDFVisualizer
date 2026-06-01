// Compile a React Flow node/edge graph into the body of a GLSL `map(vec3 p)`
// function used by the raymarcher. The graph is expanded as a tree starting
// from the Output node: position-transforming nodes thread a new position
// expression down to their children, so the same node reached through different
// transform paths is emitted independently (cheap for the small graphs here).

import { NODE_DEFS, defaultParams } from './nodes';

const FAR = '1e5';

// Format a JS number as a GLSL float literal (always with a decimal point).
function f(x) {
    let s = Number(x).toString();
    if (!/[.eE]/.test(s)) s += '.0';
    return s;
}
const v2 = (a) => `vec2(${f(a[0])}, ${f(a[1])})`;
const v3 = (a) => `vec3(${f(a[0])}, ${f(a[1])}, ${f(a[2])})`;

export function compileGraph(nodes, edges) {
    const byId = new Map(nodes.map((n) => [n.id, n]));

    // Source node id feeding a given target handle (single connection per handle).
    const sourceFor = (targetId, handle) => {
        const e = edges.find((edge) => edge.target === targetId && (edge.targetHandle || 'in') === handle);
        return e ? e.source : null;
    };

    const lines = [];
    let counter = 0;
    const alloc = (prefix = 'v') => `${prefix}${counter++}`;
    const far = () => {
        const d = alloc('d');
        lines.push(`float ${d} = ${FAR};`);
        return d;
    };

    function gen(nodeId, pExpr, stack) {
        if (!nodeId) return far();
        if (stack.has(nodeId)) return far(); // guard against cycles
        const node = byId.get(nodeId);
        if (!node) return far();
        const def = NODE_DEFS[node.data.type];
        if (!def || typeof def.glsl !== 'function') return far();

        const params = { ...defaultParams(def), ...(node.data.params || {}) };
        const childStack = new Set(stack).add(nodeId);
        const ctx = {
            p: pExpr,
            params,
            f,
            v2,
            v3,
            alloc,
            line: (src) => lines.push(src),
            gen: (handle, pos = pExpr) => gen(sourceFor(node.id, handle), pos, childStack),
        };
        return def.glsl(ctx);
    }

    const output = nodes.find((n) => n.data.type === 'output');
    if (!output) return `  return ${FAR};`;

    const root = gen(sourceFor(output.id, 'in'), 'p', new Set());
    const body = lines.map((l) => `  ${l}`).join('\n');
    return `${body}\n  return ${root};`;
}
