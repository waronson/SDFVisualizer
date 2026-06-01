// Node definitions for the SDF graph.
//
// Each definition describes how a node looks in the editor (label, category,
// input handles, editable parameters) AND how it emits GLSL when the graph is
// compiled into a raymarching `map(vec3 p)` function.
//
// The `glsl(ctx)` function receives a compiler context and must return the name
// of a GLSL variable holding the node's signed distance. The context exposes:
//   ctx.p              current position expression (a GLSL `vec3`)
//   ctx.params         resolved parameter values for this node
//   ctx.alloc(prefix)  allocate a unique GLSL identifier
//   ctx.line(src)      emit a line into the map() body
//   ctx.gen(handle, p) compile the node connected to `handle`, optionally with
//                      a transformed position; returns its distance variable
//   ctx.f / v2 / v3    format JS numbers/arrays as GLSL float / vec2 / vec3

export const FIELD = 'field';

export const NODE_DEFS = {
    // ---- Primitives ----------------------------------------------------
    sphere: {
        label: 'Sphere',
        category: 'Primitive',
        inputs: [],
        params: [{ key: 'r', label: 'Radius', min: 0.05, max: 3, step: 0.01, default: 1 }],
        glsl: (ctx) => {
            const d = ctx.alloc('d');
            ctx.line(`float ${d} = sdSphere(${ctx.p}, ${ctx.f(ctx.params.r)});`);
            return d;
        },
    },
    box: {
        label: 'Box',
        category: 'Primitive',
        inputs: [],
        params: [
            { key: 'bx', label: 'Width', min: 0.05, max: 3, step: 0.01, default: 0.8 },
            { key: 'by', label: 'Height', min: 0.05, max: 3, step: 0.01, default: 0.8 },
            { key: 'bz', label: 'Depth', min: 0.05, max: 3, step: 0.01, default: 0.8 },
            { key: 'round', label: 'Round', min: 0, max: 1, step: 0.01, default: 0.05 },
        ],
        glsl: (ctx) => {
            const p = ctx.params;
            const d = ctx.alloc('d');
            ctx.line(
                `float ${d} = sdBox(${ctx.p}, ${ctx.v3([p.bx, p.by, p.bz])}) - ${ctx.f(p.round)};`,
            );
            return d;
        },
    },
    torus: {
        label: 'Torus',
        category: 'Primitive',
        inputs: [],
        params: [
            { key: 't1', label: 'Major', min: 0.1, max: 3, step: 0.01, default: 0.9 },
            { key: 't2', label: 'Minor', min: 0.02, max: 1.5, step: 0.01, default: 0.3 },
        ],
        glsl: (ctx) => {
            const d = ctx.alloc('d');
            ctx.line(`float ${d} = sdTorus(${ctx.p}, ${ctx.v2([ctx.params.t1, ctx.params.t2])});`);
            return d;
        },
    },
    plane: {
        label: 'Plane',
        category: 'Primitive',
        inputs: [],
        params: [{ key: 'h', label: 'Height', min: -3, max: 3, step: 0.01, default: -1 }],
        glsl: (ctx) => {
            const d = ctx.alloc('d');
            ctx.line(`float ${d} = ${ctx.p}.y - ${ctx.f(ctx.params.h)};`);
            return d;
        },
    },

    // ---- Combinations --------------------------------------------------
    union: {
        label: 'Union',
        category: 'Combine',
        inputs: ['a', 'b'],
        params: [],
        glsl: (ctx) => {
            const a = ctx.gen('a');
            const b = ctx.gen('b');
            const d = ctx.alloc('d');
            ctx.line(`float ${d} = min(${a}, ${b});`);
            return d;
        },
    },
    smoothUnion: {
        label: 'Smooth Union',
        category: 'Combine',
        inputs: ['a', 'b'],
        params: [{ key: 'k', label: 'Smoothing', min: 0.01, max: 1.5, step: 0.01, default: 0.4 }],
        glsl: (ctx) => {
            const a = ctx.gen('a');
            const b = ctx.gen('b');
            const d = ctx.alloc('d');
            ctx.line(`float ${d} = opSmoothUnion(${a}, ${b}, ${ctx.f(ctx.params.k)});`);
            return d;
        },
    },
    subtract: {
        label: 'Subtract',
        category: 'Combine',
        inputs: ['a', 'b'],
        params: [{ key: 'k', label: 'Smoothing', min: 0, max: 1.5, step: 0.01, default: 0 }],
        glsl: (ctx) => {
            const a = ctx.gen('a'); // base
            const b = ctx.gen('b'); // carved away
            const d = ctx.alloc('d');
            ctx.line(`float ${d} = opSmoothSub(${b}, ${a}, ${ctx.f(ctx.params.k)});`);
            return d;
        },
    },
    intersect: {
        label: 'Intersect',
        category: 'Combine',
        inputs: ['a', 'b'],
        params: [{ key: 'k', label: 'Smoothing', min: 0, max: 1.5, step: 0.01, default: 0 }],
        glsl: (ctx) => {
            const a = ctx.gen('a');
            const b = ctx.gen('b');
            const d = ctx.alloc('d');
            ctx.line(`float ${d} = opSmoothInter(${a}, ${b}, ${ctx.f(ctx.params.k)});`);
            return d;
        },
    },

    // ---- Transforms ----------------------------------------------------
    translate: {
        label: 'Translate',
        category: 'Transform',
        inputs: ['in'],
        params: [
            { key: 'x', label: 'X', min: -3, max: 3, step: 0.01, default: 0 },
            { key: 'y', label: 'Y', min: -3, max: 3, step: 0.01, default: 0 },
            { key: 'z', label: 'Z', min: -3, max: 3, step: 0.01, default: 0 },
        ],
        glsl: (ctx) => {
            const p = ctx.alloc('p');
            const { x, y, z } = ctx.params;
            ctx.line(`vec3 ${p} = ${ctx.p} - ${ctx.v3([x, y, z])};`);
            return ctx.gen('in', p);
        },
    },
    scale: {
        label: 'Scale',
        category: 'Transform',
        inputs: ['in'],
        params: [{ key: 's', label: 'Factor', min: 0.1, max: 4, step: 0.01, default: 1 }],
        glsl: (ctx) => {
            const s = ctx.f(ctx.params.s);
            const p = ctx.alloc('p');
            ctx.line(`vec3 ${p} = ${ctx.p} / ${s};`);
            const child = ctx.gen('in', p);
            const d = ctx.alloc('d');
            ctx.line(`float ${d} = ${child} * ${s};`);
            return d;
        },
    },
    twist: {
        label: 'Twist',
        category: 'Transform',
        inputs: ['in'],
        params: [{ key: 'k', label: 'Amount', min: -4, max: 4, step: 0.01, default: 1.5 }],
        glsl: (ctx) => {
            const k = ctx.f(ctx.params.k);
            const p = ctx.alloc('p');
            const src = ctx.p;
            ctx.line(`float c_${p} = cos(${k} * ${src}.y), s_${p} = sin(${k} * ${src}.y);`);
            ctx.line(
                `vec3 ${p} = vec3(c_${p} * ${src}.x - s_${p} * ${src}.z, ${src}.y, s_${p} * ${src}.x + c_${p} * ${src}.z);`,
            );
            return ctx.gen('in', p);
        },
    },

    // ---- Distortions ---------------------------------------------------
    noiseDisplace: {
        label: 'Noise Displace',
        category: 'Distort',
        inputs: ['in'],
        params: [
            { key: 'amp', label: 'Amplitude', min: 0, max: 1.5, step: 0.01, default: 0.3 },
            { key: 'freq', label: 'Frequency', min: 0.1, max: 8, step: 0.01, default: 2 },
        ],
        glsl: (ctx) => {
            const child = ctx.gen('in');
            const d = ctx.alloc('d');
            ctx.line(
                `float ${d} = ${child} + ${ctx.f(ctx.params.amp)} * (fbm(${ctx.p} * ${ctx.f(
                    ctx.params.freq,
                )}) - 0.5);`,
            );
            return d;
        },
    },
    sineWarp: {
        label: 'Sine Warp',
        category: 'Distort',
        inputs: ['in'],
        params: [
            { key: 'amp', label: 'Amplitude', min: 0, max: 1, step: 0.01, default: 0.2 },
            { key: 'freq', label: 'Frequency', min: 0.1, max: 12, step: 0.01, default: 3 },
        ],
        glsl: (ctx) => {
            const child = ctx.gen('in');
            const d = ctx.alloc('d');
            const a = ctx.f(ctx.params.amp);
            const fr = ctx.f(ctx.params.freq);
            ctx.line(
                `float ${d} = ${child} + ${a} * sin(${fr} * ${ctx.p}.x) * sin(${fr} * ${ctx.p}.y) * sin(${fr} * ${ctx.p}.z);`,
            );
            return d;
        },
    },

    // ---- Output --------------------------------------------------------
    output: {
        label: 'Output',
        category: 'Output',
        inputs: ['in'],
        isOutput: true,
        params: [],
        glsl: null, // handled directly by the compiler
    },
};

export function defaultParams(def) {
    const out = {};
    for (const p of def.params) out[p.key] = p.default;
    return out;
}
