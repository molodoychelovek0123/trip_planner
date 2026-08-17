# TripPlanner - Stage 3 (Социальная часть)

Фронтенд динамического многодневного планировщика маршрутов, вдохновлённого Google Maps, Wanderlog и инструментами «умного времени» из JapanTravel. На текущем этапе (Stage 3) приложение перешло на полноценную клиент-серверную архитектуру и поддерживает аутентификацию, многопользовательское управление маршрутами и публичный шеринг.

## Features (Full Stack)

### Аутентификация и сессии
*   **Google OAuth 2.0 Sign-In**: вход через аккаунт Google (`/api/auth/google/url` + callback), выпуск JWT-токена и хранение профиля пользователя.
*   **Обработка истёкшей сессии**: при получении ответов `401 Unauthorized` / `403 Forbidden` от бэкенда фронтенд автоматически выполняет logout, сохраняет флаг `sessionExpired` и редиректит пользователя на страницу логина с UI-сообщением «Сессия истекла. Пожалуйста, войдите снова».

### Управление маршрутами (Multi-Trip Dashboard)
*   **Dashboard `/dashboard`**: список всех маршрутов пользователя с возможностью создания, дублирования и удаления.
*   **Редактор маршрута `/trip/:tripId`**: загрузка и синхронизация состояния маршрута с бэкендом. Синхронизация выполняется с дебаунсом и отсылает `Authorization: Bearer <token>`.
*   **Пер-маршрутное хранение состояния**: Zustand-хранилище использует ключ `trip-planner-storage:{tripId}`, чтобы разные маршруты не перезаписывали друг друга.

### Шеринг маршрутов
*   **Публичные ссылки**: любой маршрут можно отметить публичным — бэкенд генерирует уникальный `share_token`, по которому доступен публичный read-only URL вида `/share/:shareToken`.
*   **Модалка «Share Trip»**: в шапке редактора кнопка **Share** открывает модальное окно с toggle «Make public», полем для копирования публичной ссылки и кнопкой **Copy link**.
*   **Просмотр публичных маршрутов в режиме View Only**: страница `/share/:shareToken` рендерит маршрут в режиме только для просмотра — без возможности редактирования (нет добавления/удаления/перестановки мест, нет выбора отелей). В шапке отображается бейдж **View Only**, а компоненты `Sidebar` и `MapView` получают проп `readOnly={true}`.

### Планирование маршрута
*   **Modern Google Maps Integration**: использование **Places API (New)** и **Routes API (v2)** через прокси-эндпоинты бэкенда; декодирование и отрисовка реальных street-level полилиний.
*   **Rich Transit UX**: детальные цветные бейджи с нативными эмодзи (🚇, 🚌, 🚋) для альтернативных вариантов транспорта.
*   **Smart Time Cascading & Locking**: времена автоматически каскадируются при добавлении локации или времени в пути; блокировка времени прибытия генерирует блок **Free Time** либо **Warning** при опоздании.
*   **Multi-Day & Hotel Anchors**: переключение между днями, drag-and-drop через `@dnd-kit`, стартовый/конечный отели для каждого дня.
*   **Smart Suggestions**: расчёт Haversine-расстояний на клиенте для подбора ближайших сохранённых мест без лишних API-вызовов.

## Client Architecture / Routing

| Route | Экран | Требуется авторизация | Назначение |
|-------|-------|----------------------|------------|
| `/` | Auth Landing / Login | Нет | Лендинг с кнопкой «Sign in with Google», описание продукта |
| `/dashboard` | Trip Dashboard | Да | Список маршрутов пользователя, create/duplicate/delete |
| `/trip/:tripId` | Trip Editor | Да (владелец) | Многодневное планирование (Sidebar + MapView), шеринг |
| `/share/:shareToken` | Shared Trip (View Only) | Нет | Read-only просмотр публичного маршрута |

## Tech Stack

*   **React + Vite** (быстрая сборка, современный тулинг)
*   **TypeScript** (строгая типизация сложного состояния)
*   **Zustand** (лёгкое управление состоянием + persistence)
*   **Tailwind CSS** (быстрая, адаптивная стилизация)
*   **@dnd-kit** (headless, accessible drag-and-drop)
*   **react-router-dom** (клиентская маршрутизация для новых экранов)
*   **lucide-react** (иконки для кнопок Share, UserProfile и др.)
*   **Google Maps JS API Loader** (динамическая загрузка скриптов)
*   **uuid** (генерация уникальных идентификаторов)

Бэкенд-стек (подробнее в [`backend/README.md`](../backend/README.md)): **FastAPI**, **PostgreSQL** (SQLAlchemy + Alembic), **Google OAuth (Authlib)**, **JWT**, **httpx**.

## Setup

Проект состоит из двух частей: бэкенда (FastAPI + PostgreSQL) и фронтенда (React + Vite). Запускайте их поочерёдно.

### 1. Backend

1.  Перейдите в папку `backend`:
    ```bash
    cd backend
    ```
2.  Запустите PostgreSQL (если используется Docker):
    ```bash
    docker compose up -d
    ```
3.  Настройте Python-окружение и установите зависимости:
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    ```
4.  Примените миграции базы данных:
    ```bash
    alembic upgrade head
    ```
5.  Создайте `.env` из `.env.example` и заполните ключи (Google Client ID/Secret, JWT Secret, `VITE_GOOGLE_MAPS_API_KEY` и т.д.).
6.  Запустите API-сервер:
    ```bash
    uvicorn app.main:app --reload --port 8000
    ```

### 2. Frontend

1.  Вернитесь в папку `trip-planner` и установите зависимости:
    ```bash
    cd trip-planner
    npm install
    ```
2.  Создайте `.env` со ссылкой на API:
    ```env
    VITE_API_URL=http://127.0.0.1:8000
    VITE_GOOGLE_MAPS_API_KEY="your_google_maps_api_key"
    ```
3.  Запустите dev-сервер:
    ```bash
    npm run dev
    ```

### 3. Google API Key
Необходим ключ Google Maps с включёнными **Places API (New)** и **Routes API**. Для OAuth потребуются **Google Client ID** и **Client Secret** с настроенным redirect URI (`http://localhost:8000/api/auth/google/callback`).

## Moving Forward
Смотрите [`NEXT_STEPS.md`](../NEXT_STEPS.md) для дальнейшего плана развития (импорт списков Google Maps, офлайн-доработки BR-4, деплой и т.д.).