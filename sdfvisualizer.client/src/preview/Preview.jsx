import { useEffect, useRef, useState } from 'react';
import { SdfRenderer } from './SdfRenderer';
import { buildFragmentShader } from '../sdf/shader';

// Right panel: hosts the WebGL canvas and recompiles the raymarch shader
// whenever the compiled map() body changes.
export default function Preview({ mapBody }) {
    const canvasRef = useRef(null);
    const rendererRef = useRef(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        let renderer;
        try {
            renderer = new SdfRenderer(canvasRef.current);
        } catch (e) {
            const msg = String(e.message || e);
            queueMicrotask(() => setError(msg));
            return;
        }
        rendererRef.current = renderer;
        renderer.start();
        return () => {
            renderer.dispose();
            rendererRef.current = null;
        };
    }, []);

    useEffect(() => {
        const renderer = rendererRef.current;
        if (!renderer) return;
        const err = renderer.setFragmentShader(buildFragmentShader(mapBody));
        setError(err);
    }, [mapBody]);

    return (
        <div className="preview">
            <canvas ref={canvasRef} className="preview-canvas" />
            <div className="preview-hint">drag to orbit · scroll to zoom</div>
            {error && (
                <pre className="preview-error" title="Shader error">
                    {error}
                </pre>
            )}
        </div>
    );
}
