# TripPlanner (Full Stack Architecture)

Динамический многодневный планировщик маршрутов, вдохновлённый Google Maps, Wanderlog и инструментами «умного времени» из JapanTravel. Проект находится в **Stage 3 — Социальная часть**: реализованы Google OAuth-аутентификация, многопользовательское управление маршрутами (Multi-Trip Dashboard) и публичный шеринг маршрутов со ссылками View Only.

## Architecture Documentation

- [Backend Documentation](backend/README.md) - FastAPI, PostgreSQL, Google OAuth, Alembic Migrations, API Caching
- [Frontend Documentation](trip-planner/README.md) - React, Vite, Zustand, Tailwind, React Router

## Features

* **Google OAuth 2.0 (Stage 3)**: вход через Google, выпуск JWT-токена, хранение профиля пользователя; при истечении сессии (401/403) фронтенд редиректит на страницу логина с UI-сообщением.
* **Multi-Trip Dashboard (Stage 3)**: список маршрутов пользователя с созданием, дублированием и удалением; пер-маршрутное хранение состояния (`localStorage:{tripId}`) и серверная синхронизация.
* **Публичный шеринг (Stage 3)**: toggle «Make public» + модалка «Share Trip» с копированием ссылки; публичные маршруты доступны в режиме **View Only** по URL `/share/:shareToken` (без редактирования).
* **Алгоритмическое кэширование (BR-1)**: проксирование затратных Google Places и Routes API-вызовов через локальный бэкенд с кэшированием результатов в PostgreSQL для минимизации API-расходов.
* **Гибкая модель времени (BR-2 & BR-3)**: времена автоматически каскадируются при добавлении локации или времени в пути; блокировка времени прибытия создаёт «Free Time» или «Warning» при опозданиях.
* **Offline-First и синхронизация состояния (BR-4)**: React-фронтенд использует Zustand для мгновенного локального сохранения, выполняя фоновую синхронизацию с FastAPI-бэкендом с дебаунсом.
* **Modern Google Maps Integration**: использование Places API (New) и Routes API (v2) через прокси-эндпоинты; отрисовка реальных street-level полилиний.

## Quick Start Setup

Для запуска полного стека локально выполните следующие шаги.

### 1. Database & Backend Setup
Перейдите в папку `backend`, чтобы поднять Python FastAPI-сервер и базу PostgreSQL.

```bash
cd backend
# 1. Start Postgres
docker compose up -d
# 2. Setup Python environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# 3. Apply database schemas (migrations)
alembic upgrade head
# 4. Copy .env.example to .env and fill in Google OAuth & Maps keys
cp .env.example .env
# 5. Start the API server
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup
Перейдите в папку `trip-planner`, чтобы запустить React UI.

```bash
cd trip-planner
npm install
npm run dev
```

### 3. API Keys
Вам понадобится:
- **Google Maps API Key** с включёнными **Places API (New)** и **Routes API**. Добавьте его в `backend/.env` как `VITE_GOOGLE_MAPS_API_KEY`.
- **Google OAuth Client ID / Secret** для входа через Google (см. [`GOOGLE_AUTH_GUIDE.md`](GOOGLE_AUTH_GUIDE.md)). Redirect URI: `http://localhost:8000/api/auth/google/callback`.

### 4. Структура роутинга (фронтенд)

| Route | Экран | Требуется авторизация |
|-------|-------|----------------------|
| `/` | Auth Landing / Login | Нет |
| `/dashboard` | Trip Dashboard | Да |
| `/trip/:tripId` | Trip Editor | Да (владелец) |
| `/share/:shareToken` | Shared Trip (View Only) | Нет |