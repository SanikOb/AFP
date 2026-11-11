import { fireEvent, render, screen } from '@testing-library/react';
import SimpleApp from './SimpleApp';

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
    window.localStorage.clear();
});

test('каталог показывает растение из заглушки', async () => {
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

    login('curator', 'неверный');

    expect(await screen.findByText('Неверный логин или пароль')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Списать' })).not.toBeInTheDocument();
});

test('куратор добавляет растение', async () => {
    render(<SimpleApp />);
    await screen.findByText('Завьяловский гладкий вареник');

    login('curator', 'kokain');
    fireEvent.click(screen.getByRole('button', { name: 'Добавить растение' }));

    fill(/Русское название/, 'Тестовое растение');
    fill(/Латинское название/, 'Testus plantus');
    fill(/Семейство/, 'Testaceae');
    fill(/Жизненная форма/, 'травянистое');
    fill(/Описание/, 'Растение для проверки админки');
    fill(/Происхождение/, 'Тестовая местность');
    fill(/Полив/, 'умеренный');
    fill(/Свет/, 'яркий рассеянный');

    fireEvent.click(screen.getByRole('button', { name: 'Добавить' }));

    expect(await screen.findByText('Добавлено: Тестовое растение')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Каталог (2)' })).toBeInTheDocument();
});

test('куратор списывает растение своего сектора', async () => {
    render(<SimpleApp />);
    await screen.findByText('Завьяловский гладкий вареник');

    login('curator', 'kokain');

    fireEvent.click(await screen.findByRole('button', { name: 'Списать' }));

    expect(await screen.findByText('Списано')).toBeInTheDocument();
});

test('администратор БД видит заглушки бэкапа и токенов', async () => {
    render(<SimpleApp />);
    await screen.findByText('Завьяловский гладкий вареник');

    login('dbadmin', 'lotov');

    expect(screen.getByRole('heading', { name: 'Администратор БД' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Сделать бэкап' }));
    expect(await screen.findByText(/Бэкап создан/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Структура таблиц' }));
    expect(await screen.findByText('plants')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Выдать токен API' }));
    expect(await screen.findByText(/Токен API выдан: afp_/)).toBeInTheDocument();
});

