import { fireEvent, render, screen } from '@testing-library/react';
import SimpleApp from './SimpleApp';
import { MOCK_PLANTS } from './data/mockPlants';

const fill = (label, value) => {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

const login = (name, password) => {
    fireEvent.click(screen.getByRole('button', { name: 'Вход' }));
    fill('Логин', name);
    fill('Пароль', password);
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
};

beforeEach(() => {
    global.fetch = jest.fn(async (url, options) => {
        const path = new URL(url).pathname;
        let data = MOCK_PLANTS.map((plant) => ({ ...plant, exhibits: [plant] }));

        if (path === '/auth/login') {
            const { login, password } = JSON.parse(options.body);
            if (password === 'неверный') {
                return { ok: false, status: 401, json: async () => ({ detail: 'Неверный логин или пароль' }) };
            }
            const admin = login === 'admin';
            data = {
                token: 'test-token',
                user: admin
                    ? { role: 'dbadmin', title: 'Администратор БД', sector: '', sectors: [] }
                    : {
                        role: 'curator',
                        title: 'Куратор (Агроном)',
                        sector: MOCK_PLANTS[0].location,
                        sectors: [MOCK_PLANTS[0].location],
                    },
            };
        } else if (path === '/admin/backup') {
            data = { file: 'backups/example.db' };
        } else if (path === '/admin/tables') {
            data = ['plants'];
        } else if (path === '/admin/tokens') {
            data = { token: 'issued-test-token' };
        } else if (path.endsWith('/retire')) {
            data = { ...MOCK_PLANTS[0], care_status: 'written_off' };
        } else if (options?.method === 'POST') {
            const plant = JSON.parse(options.body);
            data = { ...plant, id: 2, exhibits: [plant] };
        }
        return { ok: true, json: async () => data };
    });
});

test('каталог показывает растение из ответа API', async () => {
    render(<SimpleApp />);

    expect(screen.getByRole('heading', { name: 'Ботанический сад' })).toBeInTheDocument();
    expect(await screen.findByText('Завьяловский гладкий вареник')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Каталог (1)' })).toBeInTheDocument();
});

test('посетитель видит каталог и ищет по названию или семейству', async () => {
    render(<SimpleApp />);

    expect(screen.getByRole('heading', { name: 'Ботанический сад' })).toBeInTheDocument();
    expect(await screen.findByText('Завьяловский гладкий вареник')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Каталог (1)' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Списать' })).not.toBeInTheDocument();

    fill('Поиск по названию или семейству', 'вареник');
    expect(screen.getByText('Завьяловский гладкий вареник')).toBeInTheDocument();

    fill('Поиск по названию или семейству', 'нет-такого');
    expect(screen.getByText('Ничего не найдено.')).toBeInTheDocument();
});

test('вход с неверным паролем не даёт прав куратора', async () => {
    render(<SimpleApp />);
    await screen.findByText('Завьяловский гладкий вареник');

    login('i.goliubo', 'неверный');

    expect(await screen.findByText('Неверный логин или пароль')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Списать' })).not.toBeInTheDocument();
});

test('куратор добавляет растение', async () => {
    render(<SimpleApp />);
    await screen.findByText('Завьяловский гладкий вареник');

    login('i.goliubo', 'change-me');
    fireEvent.click(await screen.findByRole('button', { name: 'Добавить растение' }));

    fill(/Русское название/, 'Тестовое растение');
    fill(/Латинское название/, 'Testus plantus');
    fill(/Семейство/, 'Testaceae');
    fill(/Жизненная форма/, 'травянистое');
    fill(/Описание/, 'Растение для проверки админки');
    fill(/Происхождение/, 'Тестовая местность');
    fill(/Полив/, 'умеренный');
    fill(/Свет/, 'яркий рассеянный');
    fill('Температура', '20 °C');
    fill('Влажность', '60%');
    fill(/Категории/, 'Лекарственные, Редкие');
    fill('Инвентарный номер', 'AFP-002');
    fill(/Координата X/, '0');
    fill(/Координата Y/, '-12.5');
    fill('Статус ухода', 'protected');
    fill('Дата посадки', '2025-05-10');
    fill('Примечание', 'Новый экземпляр');

    fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));

    expect(await screen.findByText('Добавлено: Тестовое растение')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/plants$/),
        expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
        })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Каталог (2)' }));
    expect(screen.getByText('Позиция: X = 0, Y = -12.5')).toBeInTheDocument();
    expect(screen.getByText(/Дата посадки: 2025-05-10/)).toBeInTheDocument();
    expect(screen.getByText(/Примечание: Новый экземпляр/)).toBeInTheDocument();
});

test('куратор списывает растение своего сектора', async () => {
    render(<SimpleApp />);
    await screen.findByText('Завьяловский гладкий вареник');

    login('i.goliubo', 'change-me');

    fireEvent.click(await screen.findByRole('button', { name: 'Списать' }));

    expect(await screen.findByText('Списано')).toBeInTheDocument();
});

test('администратор БД выполняет действия через API', async () => {
    render(<SimpleApp />);
    await screen.findByText('Завьяловский гладкий вареник');

    login('admin', 'change-me');

    expect(await screen.findByRole('heading', { name: 'Администратор БД' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Сделать бэкап' }));
    expect(await screen.findByText(/Бэкап создан/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Структура таблиц' }));
    expect(await screen.findByText('plants')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Выдать токен API' }));
    expect(await screen.findByText(/Токен API выдан: issued-test-token/)).toBeInTheDocument();
});

