// Client for the graph save/load API. The anonymous-user cookie is managed by
// the server; we just need to send credentials so it round-trips.

const BASE = '/api/graphs';

async function request(url, options = {}) {
    const res = await fetch(url, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });
    if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);
    if (res.status === 204) return null;
    return res.json();
}

export const listGraphs = () => request(BASE);
export const getGraph = (id) => request(`${BASE}/${encodeURIComponent(id)}`);
export const createGraph = (name, data) =>
    request(BASE, { method: 'POST', body: JSON.stringify({ name, data }) });
export const updateGraph = (id, name, data) =>
    request(`${BASE}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ name, data }) });
export const deleteGraph = (id) =>
    request(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
