// GLSL shader assembly for the raymarched SDF preview (WebGL2 / GLSL ES 3.00).

export const VERTEX_SHADER = `#version 300 es
precision highp float;
// Fullscreen triangle generated from gl_VertexID; no attributes needed.
void main() {
    vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

// Reusable distance primitives, combination operators and value-noise/fbm.
const PRELUDE = `
float sdSphere(vec3 p, float r) { return length(p) - r; }

float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

float opSmoothUnion(float a, float b, float k) {
    if (k <= 0.0) return min(a, b);
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}
// Subtract 'a' (tool) from 'b' (base).
float opSmoothSub(float a, float b, float k) {
    if (k <= 0.0) return max(b, -a);
    float h = clamp(0.5 - 0.5 * (b + a) / k, 0.0, 1.0);
    return mix(b, -a, h) + k * h * (1.0 - h);
}
float opSmoothInter(float a, float b, float k) {
    if (k <= 0.0) return max(a, b);
    float h = clamp(0.5 - 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) + k * h * (1.0 - h);
}

float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float valueNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i + vec3(0, 0, 0)), hash(i + vec3(1, 0, 0)), f.x),
                   mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
                   mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

float fbm(vec3 p) {
    float a = 0.5, s = 0.0, n = 0.0;
    for (int i = 0; i < 5; i++) {
        s += a * valueNoise(p);
        n += a;
        p *= 2.02;
        a *= 0.5;
    }
    return s / n;
}
`;

const SCENE = `
uniform vec2 uResolution;
uniform float uYaw;
uniform float uPitch;
uniform float uDist;
uniform float uTime;
out vec4 fragColor;

float map(vec3 p) {
__MAP_BODY__
}

vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.0008, 0.0);
    return normalize(vec3(
        map(p + e.xyy) - map(p - e.xyy),
        map(p + e.yxy) - map(p - e.yxy),
        map(p + e.yyx) - map(p - e.yyx)));
}

float raymarch(vec3 ro, vec3 rd, out bool hit) {
    float t = 0.0;
    hit = false;
    for (int i = 0; i < 192; i++) {
        vec3 p = ro + rd * t;
        float d = map(p);
        if (d < 0.0008 * t) { hit = true; break; }
        t += d;
        if (t > 40.0) break;
    }
    return t;
}

// Cheap ambient occlusion by sampling the field along the normal.
float calcAO(vec3 p, vec3 n) {
    float occ = 0.0, sca = 1.0;
    for (int i = 0; i < 5; i++) {
        float h = 0.01 + 0.12 * float(i);
        occ += (h - map(p + n * h)) * sca;
        sca *= 0.7;
    }
    return clamp(1.0 - 1.5 * occ, 0.0, 1.0);
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;

    vec3 target = vec3(0.0);
    float cp = cos(uPitch), sp = sin(uPitch);
    float cy = cos(uYaw), sy = sin(uYaw);
    vec3 ro = target + uDist * vec3(cp * sy, sp, cp * cy);

    vec3 fwd = normalize(target - ro);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
    vec3 up = cross(fwd, right);
    vec3 rd = normalize(uv.x * right + uv.y * up + 1.6 * fwd);

    bool hit;
    float t = raymarch(ro, rd, hit);

    vec3 col;
    if (hit) {
        vec3 p = ro + rd * t;
        vec3 n = calcNormal(p);
        vec3 lig = normalize(vec3(0.7, 0.85, 0.5));
        float dif = clamp(dot(n, lig), 0.0, 1.0);
        float sky = clamp(0.5 + 0.5 * n.y, 0.0, 1.0);
        float ao = calcAO(p, n);

        vec3 base = 0.55 + 0.45 * cos(6.2831 * (0.3 * n + vec3(0.0, 0.33, 0.67)));
        col = base * (0.20 * sky * ao + dif * vec3(1.05, 1.0, 0.9));

        vec3 ref = reflect(rd, n);
        float spec = pow(clamp(dot(ref, lig), 0.0, 1.0), 24.0);
        col += spec * 0.4;

        col = mix(col, vec3(0.09, 0.10, 0.13), 1.0 - exp(-0.012 * t * t)); // fog
    } else {
        float g = 0.5 * (rd.y + 1.0);
        col = mix(vec3(0.07, 0.08, 0.11), vec3(0.16, 0.19, 0.26), g);
    }

    col = pow(col, vec3(0.4545)); // gamma
    fragColor = vec4(col, 1.0);
}
`;

export function buildFragmentShader(mapBody) {
    return `#version 300 es
precision highp float;
${PRELUDE}
${SCENE.replace('__MAP_BODY__', mapBody)}`;
}
