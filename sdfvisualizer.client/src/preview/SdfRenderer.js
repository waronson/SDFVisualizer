// Minimal WebGL2 renderer: draws a fullscreen triangle whose fragment shader
// raymarches the compiled SDF. The React layer feeds it new fragment shader
// source whenever the graph changes; camera state lives here and is driven by
// pointer drag (orbit) and wheel (zoom).

import { VERTEX_SHADER } from '../sdf/shader';

export class SdfRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: false });
        if (!this.gl) throw new Error('WebGL2 is not supported in this browser.');

        this.program = null;
        this.uniforms = {};
        this.vao = this.gl.createVertexArray();

        this.camera = { yaw: 0.7, pitch: 0.5, dist: 5 };
        this.time0 = performance.now();
        this.running = false;
        this.dragging = false;
        this.last = { x: 0, y: 0 };

        this._frame = this._frame.bind(this);
        this._onResize = this._onResize.bind(this);
        this._attachInput();

        this.resizeObserver = new ResizeObserver(this._onResize);
        this.resizeObserver.observe(canvas);
        this._onResize();
    }

    // Compile/link a new fragment shader. Returns null on success or an error
    // string; on failure the previous program keeps rendering.
    setFragmentShader(fragSrc) {
        const gl = this.gl;
        const vs = this._compile(gl.VERTEX_SHADER, VERTEX_SHADER);
        if (vs.error) return vs.error;
        const fs = this._compile(gl.FRAGMENT_SHADER, fragSrc);
        if (fs.error) {
            gl.deleteShader(vs.shader);
            return fs.error;
        }

        const program = gl.createProgram();
        gl.attachShader(program, vs.shader);
        gl.attachShader(program, fs.shader);
        gl.linkProgram(program);
        gl.deleteShader(vs.shader);
        gl.deleteShader(fs.shader);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const log = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            return log || 'Shader link failed.';
        }

        if (this.program) gl.deleteProgram(this.program);
        this.program = program;
        this.uniforms = {
            uResolution: gl.getUniformLocation(program, 'uResolution'),
            uYaw: gl.getUniformLocation(program, 'uYaw'),
            uPitch: gl.getUniformLocation(program, 'uPitch'),
            uDist: gl.getUniformLocation(program, 'uDist'),
            uTime: gl.getUniformLocation(program, 'uTime'),
        };
        return null;
    }

    _compile(type, src) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const log = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            return { error: log || 'Shader compile failed.' };
        }
        return { shader };
    }

    start() {
        if (this.running) return;
        this.running = true;
        requestAnimationFrame(this._frame);
    }

    stop() {
        this.running = false;
    }

    _frame() {
        if (!this.running) return;
        const gl = this.gl;
        if (this.program) {
            gl.useProgram(this.program);
            gl.bindVertexArray(this.vao);
            gl.uniform2f(this.uniforms.uResolution, this.canvas.width, this.canvas.height);
            gl.uniform1f(this.uniforms.uYaw, this.camera.yaw);
            gl.uniform1f(this.uniforms.uPitch, this.camera.pitch);
            gl.uniform1f(this.uniforms.uDist, this.camera.dist);
            gl.uniform1f(this.uniforms.uTime, (performance.now() - this.time0) * 0.001);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
        requestAnimationFrame(this._frame);
    }

    _onResize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
        const h = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w;
            this.canvas.height = h;
            this.gl.viewport(0, 0, w, h);
        }
    }

    _attachInput() {
        const c = this.canvas;
        this._onDown = (e) => {
            this.dragging = true;
            this.last = { x: e.clientX, y: e.clientY };
            c.setPointerCapture(e.pointerId);
        };
        this._onMove = (e) => {
            if (!this.dragging) return;
            const dx = e.clientX - this.last.x;
            const dy = e.clientY - this.last.y;
            this.last = { x: e.clientX, y: e.clientY };
            this.camera.yaw -= dx * 0.008;
            this.camera.pitch = Math.max(-1.5, Math.min(1.5, this.camera.pitch + dy * 0.008));
        };
        this._onUp = (e) => {
            this.dragging = false;
            if (c.hasPointerCapture(e.pointerId)) c.releasePointerCapture(e.pointerId);
        };
        this._onWheel = (e) => {
            e.preventDefault();
            this.camera.dist = Math.max(1.2, Math.min(20, this.camera.dist * (1 + e.deltaY * 0.001)));
        };
        c.addEventListener('pointerdown', this._onDown);
        c.addEventListener('pointermove', this._onMove);
        c.addEventListener('pointerup', this._onUp);
        c.addEventListener('pointercancel', this._onUp);
        c.addEventListener('wheel', this._onWheel, { passive: false });
    }

    dispose() {
        this.stop();
        this.resizeObserver.disconnect();
        const c = this.canvas;
        c.removeEventListener('pointerdown', this._onDown);
        c.removeEventListener('pointermove', this._onMove);
        c.removeEventListener('pointerup', this._onUp);
        c.removeEventListener('pointercancel', this._onUp);
        c.removeEventListener('wheel', this._onWheel);
        if (this.program) this.gl.deleteProgram(this.program);
    }
}
