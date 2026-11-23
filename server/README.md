# FAST API Python бекэнд

Ну типа на другом языке, прикольно, стильно, молодежно. Добавим в резюме, что умеем дрюкать на питоне

## DEPENDENCIES
```
py -m pip install fastapi[standart]
py -m pip install uvicorn[standart]
py -m pip install sqlalchemy     
```

## START

```
python3 -m venv .venv
source .venv/bin/activate
py main.py
```

## БД

Схема по ТЗ: `plants`, 
             `plant_characteristics`, 
             `locations`, 
             `exhibits`, 
             `categories`, 
             `garden_staff`, 
             `roles`.

Наполнить тестовыми растениями:

```
py -m db.seed
```

## Локальная проверка фронтенда и API

Из папки `server` установите зависимости и запустите API:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install fastapi uvicorn sqlalchemy
python -m db.seed
python -m uvicorn main:app --port 8000
```

Из папки `client` в отдельном терминале:

```sh
npm ci
npm start
```

В тестовой базе `i.goliubo` — куратор, `admin` — администратор БД.
Начальный пароль обоих аккаунтов — `change-me`. Используйте эти аккаунты только
с локальными демонстрационными данными. Секторы куратора определяются по локациям
его экземпляров из БД. Бэкапы SQLite сохраняются в папке `backups` рядом с `db.db`.
