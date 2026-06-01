import { useEffect, useRef, useState } from 'react';

// Toolbar above the node editor: rename / new / save, plus an "Open" dropdown
// listing the user's saved graphs (with per-item delete).
export default function GraphMenu({
    name,
    onNameChange,
    onNew,
    onSave,
    onOpen,
    onDelete,
    graphs,
    currentId,
    status,
    busy,
    serverError,
}) {
    const [open, setOpen] = useState(false);
    const openRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const onDocClick = (e) => {
            if (openRef.current && !openRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [open]);

    return (
        <div className="menubar">
            <input
                className="menu-name"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="Untitled"
                aria-label="Graph name"
            />
            <button className="menu-btn" onClick={onNew} disabled={busy}>
                New
            </button>
            <button className="menu-btn menu-btn-primary" onClick={onSave} disabled={busy}>
                {currentId ? 'Save' : 'Save as new'}
            </button>

            <div className="menu-open" ref={openRef}>
                <button
                    className="menu-btn"
                    onClick={() => setOpen((o) => !o)}
                    disabled={busy}
                    aria-expanded={open}
                >
                    Open ▾
                </button>
                {open && (
                    <div className="menu-dropdown">
                        {graphs.length === 0 && <div className="menu-empty">No saved graphs</div>}
                        {graphs.map((g) => (
                            <div
                                key={g.id}
                                className={`menu-item ${g.id === currentId ? 'is-current' : ''}`}
                            >
                                <button
                                    className="menu-item-name"
                                    onClick={() => {
                                        onOpen(g.id);
                                        setOpen(false);
                                    }}
                                    title={g.name}
                                >
                                    {g.name}
                                </button>
                                <button
                                    className="menu-item-del"
                                    title="Delete graph"
                                    onClick={() => onDelete(g.id)}
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <span className={`menu-status ${serverError ? 'is-error' : ''}`}>
                {serverError ? 'server offline' : status}
            </span>
        </div>
    );
}
