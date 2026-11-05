import { MOCK_PLANTS } from '../data/mockPlants';

export const SERVER_URL = 'http://localhost:8000';
export const USE_SERVER = false;

// Если поменял данные в src/data/mockPlants.js увеличь версию ключа
// иначе браузер продолжит ебашить старые данные из localStorage
const STORAGE_KEY = 'plants-v2';

function readLocalPlants() {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (raw) {
        try {
            return JSON.parse(raw);
        } catch (e) {
            console.warn('Не удалось прочитать localStorage', e);
        }
    }

    writeLocalPlants(MOCK_PLANTS);
    return MOCK_PLANTS;
}

function writeLocalPlants(plants) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plants));
}

function nextId(plants) {
    return plants.reduce((max, plant) => Math.max(max, Number(plant.id) || 0), 0) + 1;
}

async function request(path, options) {
    const response = await fetch(`${SERVER_URL}${path}`, options);

    if (!response.ok) {
        throw new Error(`Сервер ответил ${response.status}`);
    }

    return response.json();
}

export async function loadPlants() {
    if (USE_SERVER) {
        try {
            return await request('/plants');
        } catch (e) {
            console.warn('Сервер недоступен, показываю заглушку', e);
        }
    }

    return readLocalPlants();
}

export async function createPlant(plant) {
    if (USE_SERVER) {
        return request('/plants', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(plant),
        });
    }

    const plants = readLocalPlants();
    const created = { ...plant, id: nextId(plants) };

    writeLocalPlants([...plants, created]);
    return created;
}

// Изменение растения (куратор своего сектора). На сервере: PUT /plants/{id}
export async function updatePlant(id, plant) {
    if (USE_SERVER) {
        return request(`/plants/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(plant),
        });
    }

    const plants = readLocalPlants();
    const updated = { ...plant, id };

    writeLocalPlants(plants.map((item) => (item.id === id ? updated : item)));
    return updated;
}

// Списание растения: помечаем статус, запись остаётся в базе.
// На сервере: POST /plants/{id}/retire
export async function retirePlant(id) {
    if (USE_SERVER) {
        return request(`/plants/${id}/retire`, { method: 'POST' });
    }

    const plants = readLocalPlants();
    let retired = null;

    writeLocalPlants(
        plants.map((item) => {
            if (item.id !== id) {
                return item;
            }

            retired = { ...item, care_status: 'written_off' };
            return retired;
        })
    );

    return retired;
}

// Заглушки администратора БД. Всё это делает сервер Python (root-доступ):
// бэкапы, структура таблиц, выдача токенов API.
export async function createBackup() {
    if (USE_SERVER) {
        return request('/admin/backup', { method: 'POST' });
    }

    return { file: `backup-${new Date().toISOString().slice(0, 19)}.db` };
}

export async function listTables() {
    if (USE_SERVER) {
        return request('/admin/tables');
    }

    return ['plants', 'plant_characteristics', 'categories', 'exhibits', 'locations', 'garden_staff'];
}

export async function issueApiToken() {
    if (USE_SERVER) {
        return request('/admin/tokens', { method: 'POST' });
    }

    return { token: `afp_${Math.random().toString(36).slice(2, 10)}` };
}
