import React, { useEffect, useState } from 'react';
import {
    createBackup,
    createPlant,
    issueApiToken,
    listTables,
    loadPlants,
    retirePlant,
    updatePlant,
} from './services/plantsApi';

// Заглушка авторизации: настоящие проверки пароля и токены выдаёт сервер.
// curator — куратор сектора (пароль kokain), dbadmin — администратор БД (пароль lotov).
const USERS = {
    curator: {
        password: 'kokain',
        role: 'curator',
        title: 'Куратор (Агроном)',
        sector: 'Завьяловский огород',
    },
    dbadmin: {
        password: 'lotov',
        role: 'dbadmin',
        title: 'Администратор БД',
        sector: '',
    },
};

const GUEST = { role: 'guest', title: 'Посетитель / Студент', sector: '' };

function SimpleApp() {
    const [tab, setTab] = useState('catalog');
    const [plants, setPlants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(GUEST);
    const [editing, setEditing] = useState(null);
    const [search, setSearch] = useState('');

    useEffect(() => {
        loadPlants()
            .then((data) => setPlants(data))
            .finally(() => setLoading(false));
    }, []);

    const isCurator = user.role === 'curator';
    const isDbAdmin = user.role === 'dbadmin';

    const handleLogin = (login, password) => {
        const found = USERS[login.trim().toLowerCase()];

        if (!found || found.password !== password) {
            return false;
        }

        setUser(found);
        setEditing(null);
        setTab(found.role === 'dbadmin' ? 'dbadmin' : 'catalog');
        return true;
    };

    const handleLogout = () => {
        setUser(GUEST);
        setEditing(null);
        setTab('catalog');
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
        const retired = await retirePlant(id);
        setPlants((prev) => prev.map((item) => (item.id === id ? retired : item)));
    };

    // Куратор управляет только растениями своего сектора.
    const canManage = (plant) => isCurator && plant.location === user.sector;

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
                {user.sector ? ` (сектор: ${user.sector})` : ''}
            </p>

            <button type="button" onClick={() => setTab('catalog')}>
                Каталог ({plants.length})
            </button>{' '}
            {isCurator && (
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

            {!loading && tab === 'catalog' && (
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

    const handleSubmit = (event) => {
        event.preventDefault();

        if (onLogin(login, password)) {
            setError('');
            return;
        }

        setError('Неверный логин или пароль');
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
                <button type="submit">Войти</button>
            </p>

            {error && <p>{error}</p>}

            <p>Заглушка: curator / kokain, dbadmin / lotov.</p>
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
                        <p>
                            Инв. №: {plant.inventory_number || '—'}. Локация: {plant.location || '—'}.
                            Статус: {plant.care_status || '—'}
                        </p>
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
            categories: form.categories
                .split(',')
                .map((name) => name.trim())
                .filter(Boolean),
        };

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
            {textField('location', 'Локация')}

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
                <button type="submit">{editing ? 'Сохранить' : 'Добавить'}</button>{' '}
                <button type="button" onClick={onCancel}>
                    Отмена
                </button>
            </p>

            {message && <p>{message}</p>}
        </form>
    );
}

// Администратор БД: бэкапы, структура таблиц, токены API.
// Клиент только показывает результат — всё делает сервер Python (root-доступ).
function DbAdminPanel() {
    const [message, setMessage] = useState('');
    const [tables, setTables] = useState([]);

    const handleBackup = async () => {
        const result = await createBackup();
        setMessage(`Бэкап создан: ${result.file}`);
    };

    const handleTables = async () => {
        setTables(await listTables());
    };

    const handleToken = async () => {
        const result = await issueApiToken();
        setMessage(`Токен API выдан: ${result.token}`);
    };

    return (
        <div>
            <h2>Администратор БД</h2>
            <p>
                Заглушки: бэкапы, структуру таблиц и токены API выдаёт сервер Python (root-доступ).
            </p>

            <p>
                <button type="button" onClick={handleBackup}>
                    Сделать бэкап
                </button>{' '}
                <button type="button" onClick={handleTables}>
                    Структура таблиц
                </button>{' '}
                <button type="button" onClick={handleToken}>
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
