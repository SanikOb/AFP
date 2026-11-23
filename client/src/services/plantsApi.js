import { CONFIG } from '../config';

const SERVER_URL = process.env.REACT_APP_SERVER_URL || CONFIG.HOST;

let token = null;

async function request(path, options = {}) {
    let response;
    try {
        response = await fetch(`${SERVER_URL}${path}`, {
            ...options,
            headers: {
                ...options.headers,
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        });
    } catch {
        throw new Error('Не удалось связаться с сервером');
    }

    if (!response.ok) {
        const error = await response.json().catch(() => null);
        const detail = typeof error?.detail === 'string' ? error.detail : null;
        throw new Error(detail || `Сервер ответил ${response.status}`);
    }

    return response.status === 204 ? null : response.json();
}

export function loadPlants() {
    return request('/plants');
}

function sendJson(path, method, plant) {
    return request(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plant),
    });
}

export function createPlant(plant) {
    return sendJson('/plants', 'POST', plant);
}

export function updatePlant(id, plant) {
    return sendJson(`/plants/${id}`, 'PUT', plant);
}

export function retirePlant(id) {
    return request(`/plants/${id}/retire`, { method: 'POST' });
}

export async function loginStaff(login, password) {
    const result = await sendJson('/auth/login', 'POST', { login, password });
    token = result.token;
    return result.user;
}

export async function logoutStaff() {
    try {
        await request('/auth/logout', { method: 'POST' });
    } finally {
        token = null;
    }
}

export function createBackup() {
    return request('/admin/backup', { method: 'POST' });
}

export function listTables() {
    return request('/admin/tables');
}

export function issueApiToken() {
    return request('/admin/tokens', { method: 'POST' });
}
