import React, { useEffect, useState } from 'react';
import {
    createBackup,
    createPlant,
    issueApiToken,
    listTables,
    loadPlants,
    loginStaff,
    logoutStaff,
    retirePlant,
    updatePlant,
} from './services/plantsApi';

const GUEST = { role: 'guest', title: 'Посетитель / Студент', sector: '' };

function SimpleApp() {
    const [tab, setTab] = useState('catalog');
    const [plants, setPlants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [retireError, setRetireError] = useState('');
    const [user, setUser] = useState(GUEST);
    const [editing, setEditing] = useState(null);
    const [search, setSearch] = useState('');

    const refreshCatalog = () => {
        setLoading(true);
        setLoadError('');
        loadPlants()
            .then((data) => setPlants(data))
            .catch((error) => setLoadError(error.message))
            .finally(() => setLoading(false));
    };

    useEffect(refreshCatalog, []);

    const isCurator = user.role === 'curator';
    const isDbAdmin = user.role === 'dbadmin';

    const handleLogin = async (login, password) => {
        const profile = await loginStaff(login, password);
        setUser(profile);
        setEditing(null);
        setTab(profile.role === 'dbadmin' ? 'dbadmin' : 'catalog');
    };

    const handleLogout = async () => {
        try {
            await logoutStaff();
        } catch (error) {
            setRetireError(error.message);
        } finally {
            setUser(GUEST);
            setEditing(null);
            setTab('catalog');
        }
    };

    const handleCreate = async (plant) => {
        const created = await createPlant(plant);
        setPlants((prev) => [...prev, created]);
        return created;
    };

    const handleUpdate = async (id, plant) => {
        const updated = await updatePlant(id, plant);
        setPlants((prev) => prev.map((item) => (item.id === id ? updated : item)));
        return updated;
    };

    const handleRetire = async (id) => {
        setRetireError('');
        try {
            const retired = await retirePlant(id);
            setPlants((prev) => prev.map((item) => (item.id === id ? retired : item)));
        } catch (error) {
            setRetireError(error.message);
        }
    };

    // Куратор управляет только растениями своего сектора.
    const canManage = (plant) => isCurator && user.sectors.includes(plant.location);

    const openEditor = (plant) => {
        setEditing(plant);
        setTab('editor');
    };

    const closeEditor = () => {
        setEditing(null);
        setTab('catalog');
    };

    return (
        <div>
            <h1>Ботанический сад</h1>

            <p>
                Роль: <b>{user.title}</b>
                {user.sector ? ` (секторы: ${user.sectors.join(', ')})` : ''}
            </p>

            <button type="button" onClick={() => setTab('catalog')}>
                Каталог ({plants.length})
            </button>{' '}
            {isCurator && user.sectors.length > 0 && (
                <button type="button" onClick={() => openEditor(null)}>
                    Добавить растение
                </button>
            )}{' '}
            {isDbAdmin && (
                <button type="button" onClick={() => setTab('dbadmin')}>
                    Админ БД
                </button>
            )}{' '}
            {user.role === 'guest' ? (
                <button type="button" onClick={() => setTab('login')}>
                    Вход
                </button>
            ) : (
                <button type="button" onClick={handleLogout}>
                    Выйти
                </button>
            )}

            <hr />

            {loading && <p>Загрузка…</p>}

            {tab === 'catalog' && loadError && (
                <div>
                    <p role="alert">Не удалось загрузить каталог: {loadError}</p>
                    <button type="button" onClick={refreshCatalog}>Повторить</button>
                </div>
            )}
            {tab === 'catalog' && retireError && <p role="alert">{retireError}</p>}

            {!loading && !loadError && tab === 'catalog' && (
                <Catalog
                    plants={plants}
                    search={search}
                    onSearch={setSearch}
                    canManage={canManage}
                    onEdit={openEditor}
                    onRetire={handleRetire}
                />
            )}

            {!loading && tab === 'login' && <LoginForm onLogin={handleLogin} />}

            {!loading && tab === 'editor' && isCurator && (
                <AdminPanel
                    key={editing ? editing.id : 'new'}
                    user={user}
                    editing={editing}
                    onCreate={handleCreate}
                    onUpdate={handleUpdate}
                    onCancel={closeEditor}
                />
            )}

            {!loading && tab === 'dbadmin' && isDbAdmin && <DbAdminPanel />}
        </div>
    );
}

function LoginForm({ onLogin }) {
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            await onLogin(login, password);
        } catch (error) {
            setError(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <h2>Вход</h2>
            <p>Каталог доступен без входа — посетителю авторизация не нужна.</p>

            <p>
                <label>
                    Логин
                    <br />
                    <input value={login} onChange={(event) => setLogin(event.target.value)} />
                </label>
            </p>

            <p>
                <label>
                    Пароль
                    <br />
                    <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                    />
                </label>
            </p>

            <p>
                <button type="submit" disabled={submitting}>Войти</button>
            </p>

            {error && <p>{error}</p>}

        </form>
    );
}

function Catalog({ plants, search, onSearch, canManage, onEdit, onRetire }) {
    if (plants.length === 0) {
        return <p>В базе пока нет растений.</p>;
    }

    const query = search.trim().toLowerCase();
    const found = plants.filter((plant) =>
        `${plant.russian_name} ${plant.latin_name} ${plant.family}`.toLowerCase().includes(query)
    );

    return (
        <div>
            <h2>Каталог ({found.length})</h2>

            <p>
                <label>
                    Поиск по названию или семейству
                    <br />
                    <input value={search} onChange={(event) => onSearch(event.target.value)} />
                </label>
            </p>

            {found.length === 0 && <p>Ничего не найдено.</p>}

            <ul>
                {found.map((plant) => (
                    <li key={plant.id}>
                        <p>
                            <b>{plant.russian_name}</b> <i>({plant.latin_name})</i>
                        </p>
                        <p>
                            Семейство: {plant.family}. Форма: {plant.life_form}. Происхождение:{' '}
                            {plant.geographic_origin}
                        </p>
                        <p>
                            Полив: {plant.watering}. Свет: {plant.light}. Температура:{' '}
                            {plant.temperature || '—'}. Влажность: {plant.humidity || '—'}
                        </p>
                        <p>Категории: {(plant.categories || []).join(', ') || '—'}</p>
                        {(plant.exhibits || []).map((exhibit) => (
                            <div key={exhibit.inventory_number}>
                                <p>
                                    Инв. №: {exhibit.inventory_number}. Локация: {exhibit.location}.
                                    Статус: {exhibit.care_status}
                                </p>
                                <p>
                                    Позиция: {exhibit.x == null || exhibit.y == null
                                        ? 'не задана'
                                        : `X = ${exhibit.x}, Y = ${exhibit.y}`}
                                </p>
                                <p>Дата посадки: {exhibit.planted_at || '—'}</p>
                                <p>Примечание: {exhibit.notes || '—'}</p>
                            </div>
                        ))}
                        <p>{plant.description}</p>

                        {plant.care_status === 'written_off' && (
                            <p>
                                <b>Списано</b>
                            </p>
                        )}

                        {canManage(plant) && (
                            <p>
                                <button type="button" onClick={() => onEdit(plant)}>
                                    Изменить
                                </button>{' '}
                                <button type="button" onClick={() => onRetire(plant.id)}>
                                    Списать
                                </button>
                            </p>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}

const EMPTY_FORM = {
    russian_name: '',
    latin_name: '',
    family: '',
    life_form: '',
    description: '',
    geographic_origin: '',
    watering: '',
    light: '',
    temperature: '',
    humidity: '',
    categories: '',
    inventory_number: '',
    location: '',
    x: '',
    y: '',
    care_status: 'stable',
    planted_at: '',
    notes: '',
};

const REQUIRED_FIELDS = [
    'russian_name',
    'latin_name',
    'family',
    'life_form',
    'description',
    'geographic_origin',
    'watering',
    'light',
];

function toForm(plant) {
    const form = { ...EMPTY_FORM };

    Object.keys(form).forEach((key) => {
        if (plant[key] !== undefined && plant[key] !== null) {
            form[key] = String(plant[key]);
        }
    });

    form.categories = (plant.categories || []).join(', ');
    return form;
}

// Куратор: добавление и изменение растений. Сектор подставляется автоматически.
function AdminPanel({ user, editing, onCreate, onUpdate, onCancel }) {
    const [form, setForm] = useState(() =>
        editing ? toForm(editing) : { ...EMPTY_FORM, location: user.sector }
    );
    const [message, setMessage] = useState('');
    const [saving, setSaving] = useState(false);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        const hasEmptyField = REQUIRED_FIELDS.some((name) => !form[name].trim());
        if (hasEmptyField) {
            setMessage('Заполните обязательные поля');
            return;
        }

        const plant = {
            ...form,
            x: Number(form.x),
            y: Number(form.y),
            categories: form.categories
                .split(',')
                .map((name) => name.trim())
                .filter(Boolean),
        };

        setSaving(true);
        setMessage('');
        try {
            if (editing) {
                const saved = await onUpdate(editing.id, plant);
                setMessage(`Сохранено: ${saved.russian_name}`);
                return;
            }

            const created = await onCreate(plant);
            setForm({ ...EMPTY_FORM, location: user.sector });
            setMessage(`Добавлено: ${created.russian_name}`);
        } catch (e) {
            setMessage(`Ошибка: ${e.message}`);
        } finally {
            setSaving(false);
        }
    };

    const textField = (name, label, type = 'text') => (
        <p>
            <label>
                {label}
                <br />
                <input type={type} name={name} value={form[name]} onChange={handleChange} />
            </label>
        </p>
    );

    const textareaField = (name, label) => (
        <p>
            <label>
                {label}
                <br />
                <textarea name={name} rows="3" value={form[name]} onChange={handleChange} />
            </label>
        </p>
    );

    return (
        <form onSubmit={handleSubmit}>
            <h2>{editing ? 'Редактирование растения' : 'Новое растение'}</h2>
            <p>Поля со звёздочкой обязательны. Категории — через запятую.</p>

            {textField('russian_name', 'Русское название *')}
            {textField('latin_name', 'Латинское название *')}
            {textField('family', 'Семейство *')}
            {textField('life_form', 'Жизненная форма *')}

            {textareaField('description', 'Описание *')}
            {textField('geographic_origin', 'Происхождение *')}
            {textField('watering', 'Полив *')}
            {textField('light', 'Свет *')}
            {textField('temperature', 'Температура')}
            {textField('humidity', 'Влажность')}
            {textField('categories', 'Категории (через запятую)')}
            {textField('inventory_number', 'Инвентарный номер')}
            <p>
                <label>
                    Локация
                    <br />
                    <select name="location" value={form.location} onChange={handleChange}>
                        {user.sectors.map((sector) => (
                            <option key={sector}>{sector}</option>
                        ))}
                    </select>
                </label>
            </p>

            <p>
                <label>
                    Координата X *
                    <br />
                    <input type="number" step="any" name="x" value={form.x} onChange={handleChange} required />
                </label>
            </p>
            <p>
                <label>
                    Координата Y *
                    <br />
                    <input type="number" step="any" name="y" value={form.y} onChange={handleChange} required />
                </label>
            </p>

            <p>
                <label>
                    Статус ухода
                    <br />
                    <select name="care_status" value={form.care_status} onChange={handleChange}>
                        <option value="stable">Стабильное</option>
                        <option value="needs_attention">Требует внимания</option>
                        <option value="protected">Охраняемый</option>
                        <option value="written_off">Списано</option>
                    </select>
                </label>
            </p>

            {textField('planted_at', 'Дата посадки', 'date')}
            {textareaField('notes', 'Примечание')}

            <p>
                <button type="submit" disabled={saving}>{editing ? 'Сохранить' : 'Добавить'}</button>{' '}
                <button type="button" onClick={onCancel}>
                    Отмена
                </button>
            </p>

            {message && <p>{message}</p>}
        </form>
    );
}

function DbAdminPanel() {
    const [message, setMessage] = useState('');
    const [tables, setTables] = useState([]);
    const [busy, setBusy] = useState(false);

    const run = async (action) => {
        setMessage('');
        setBusy(true);
        try {
            await action();
        } catch (error) {
            setMessage(error.message);
        } finally {
            setBusy(false);
        }
    };

    const handleBackup = () => run(async () => {
        const result = await createBackup();
        setMessage(`Бэкап создан: ${result.file}`);
    });

    const handleTables = () => run(async () => {
        setTables(await listTables());
    });

    const handleToken = () => run(async () => {
        const result = await issueApiToken();
        setMessage(`Токен API выдан: ${result.token}`);
    });

    return (
        <div>
            <h2>Администратор БД</h2>

            <p>
                <button type="button" onClick={handleBackup} disabled={busy}>
                    Сделать бэкап
                </button>{' '}
                <button type="button" onClick={handleTables} disabled={busy}>
                    Структура таблиц
                </button>{' '}
                <button type="button" onClick={handleToken} disabled={busy}>
                    Выдать токен API
                </button>
            </p>

            {tables.length > 0 && (
                <ul>
                    {tables.map((name) => (
                        <li key={name}>{name}</li>
                    ))}
                </ul>
            )}

            {message && <p>{message}</p>}
        </div>
    );
}

export default SimpleApp;
