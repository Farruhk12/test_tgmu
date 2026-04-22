# MedTest Platform

Платформа для генерации медицинских тестов с мульти-агентной AI-архитектурой.

## Архитектура

- **Backend:** Node.js + Express (хранилище в памяти, без БД)
- **Frontend:** React (Vite) + Tailwind CSS
- **AI:** OpenAI / Anthropic (пайплайн: Генератор → Ревьюер, который проверяет и исправляет в одном вызове)
- **Auth:** JWT (опциональный, по умолчанию включён режим SKIP_AUTH)

> ⚠️ Текущий режим: **in-memory**. Все данные (пользователи, каталог, тесты) хранятся в памяти процесса и теряются при перезапуске backend. Справочники (факультеты, курсы, кафедры, предметы) засеиваются при старте.

## Требования

- Node.js 20+
- API-ключ OpenAI **или** Anthropic

## Установка

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# Открыть .env и вписать:
#   OPENAI_API_KEY=sk-...    (или ANTHROPIC_API_KEY=sk-ant-...)
#   JWT_SECRET=любая-длинная-строка
npm run dev
```

Backend запустится на `http://localhost:4000`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend запустится на `http://localhost:5173`

## Функционал MVP

- ✅ Регистрация/вход (JWT) либо режим SKIP_AUTH (по умолчанию)
- ✅ Каскадный выбор: Факультет → Курс → Кафедра → Предмет
- ✅ Добавление тем + параметры (тип, сложность, количество)
- ✅ Мульти-агентный пайплайн генерации
- ✅ Просмотр и редактирование теста
- ✅ Сохранение тестов в личный кабинет (в памяти)
- ✅ Экспорт в .docx

## Пайплайн генерации

1. **Генератор** — создаёт вопросы по заданным параметрам (gpt-4o / claude-sonnet)
2. **Ревьюер** — в одном вызове оценивает по чеклисту и сразу возвращает исправленную версию для "fix"-вердиктов (gpt-4o-mini / claude-haiku)

Оптимизации:
- **Объединённый ревью+правка** в одном вызове — 2 вызова на блок вместо 3
- **Параллельная обработка блоков** (`Promise.all` по темам)
- **Prompt caching** (Anthropic): статичный system-промпт кешируется на 5 минут
- **Флаг «быстрый режим»** (skipReview) — пропускает ревью при необходимости
- **Лёгкая модель для ревью** по умолчанию (haiku / gpt-4o-mini)

Модели настраиваются через переменные окружения (`OPENAI_MODEL_*` или `ANTHROPIC_MODEL_*`).

## Структура

```
medtest-platform/
├── backend/
│   ├── src/
│   │   ├── index.js              # точка входа
│   │   ├── db/
│   │   │   └── store.js          # in-memory хранилище + сид каталога
│   │   ├── middleware/auth.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── catalog.js        # факультеты/кафедры/предметы
│   │   │   └── tests.js          # CRUD тестов
│   │   └── services/
│   │       ├── llm.js            # клиент OpenAI/Anthropic + prompt caching
│   │       ├── generator.js      # агент 1 — генерация
│   │       ├── reviewer.js       # агент 2 — проверка+правка в одном вызове
│   │       ├── pipeline.js       # оркестратор (параллельные блоки)
│   │       ├── questionFormat.js # формат @/#/#&
│   │       └── docx.js           # экспорт
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx
    │   ├── api/client.js
    │   ├── pages/
    │   │   ├── Dashboard.jsx
    │   │   ├── CreateTest.jsx    # мастер
    │   │   └── ViewTest.jsx
    │   └── styles/index.css
    ├── package.json
    ├── vite.config.js
    └── tailwind.config.js
```
