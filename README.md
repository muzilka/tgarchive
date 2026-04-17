# TGArchive - Telegram Chat Archive Web Viewer

Веб-приложение для просмотра экспортированных Telegram чатов с поддержкой OIDC аутентификации и управлением доступом к группам.

<img src="https://img.shields.io/badge/Node.js-20+-green" alt="Node.js 20+">
<img src="https://img.shields.io/badge/Docker-Supported-blue" alt="Docker">
<img src="https://img.shields.io/badge/OIDC-Supported-purple" alt="OIDC">

## 📋 Содержание

- [Возможности](#-возможности)
- [Требования](#-требования)
- [Установка](#-установка)
- [Использование](#-использование)
  - [Локально](#локально)
  - [В Docker](#в-docker)
- [Конфигурация](#-конфигурация)
- [Структура проекта](#-структура-проекта)
- [API](#-api)
- [Troubleshooting](#-troubleshooting)
- [Лицензия](#-лицензия)

## ✨ Возможности

- 🔐 **OIDC Аутентификация** - Интеграция с Authentik и другими OIDC провайдерами
- 👥 **Управление доступом по группам** - Контроль доступа к чатам на основе групп пользователя
- 📅 **Интеллектуальные разделители дат** - Автоматическое форматирование дат с помощью текущего года
- 🎨 **Красивый интерфейс** - Отзывчивый веб-интерфейс для просмотра чатов
- 📱 **Поддержка медиа** - Отображение фотографий, видео, голосовых сообщений и стикеров
- 🔍 **Навигация по чатам** - Удобный список доступных чатов с информацией об ограничениях доступа
- 🐳 **Docker Support** - Готовый Docker образ и docker-compose конфигурация
- ⚡ **Graceful Shutdown** - Корректное завершение контейнера с обработкой сигналов

## 🔧 Требования

### Локальное развитие:
- **Node.js** 20+ (рекомендуется 20.x LTS)
- **npm** 10+ (поставляется с Node.js)
- **Authentik** или другой OIDC провайдер (для функции аутентификации)

### Docker:
- **Docker** 20.10+
- **Docker Compose** 1.29+ (или Docker Compose V2)

## 📦 Установка

### Клонирование репозитория

```bash
git clone https://github.com/muzilka/tgarchive.git
cd tgarchive/app
```

### Установка зависимостей

```bash
npm install
```

### Подготовка данных

1. Экспортируй чаты из Telegram через десктопный клиент
2. Поместить папку экспорта в `chats_data/` директорию
3. Структура должна быть: `chats_data/ChatName/result.json`

## 🚀 Использование

### Локально

#### 1. Настройка переменных окружения

```bash
# Скопируй пример конфигурации
cp .env.example .env

# Отредактируй .env с твоими credentials
# Минимальные переменные:
# OIDC_ISSUER - URL твоего Authentik или OIDC провайдера
# OIDC_CLIENT_ID - ID клиента из OIDC провайдера
# OIDC_CLIENT_SECRET - Секрет клиента
# REDIRECT_URI - http://localhost:3000/auth/callback (для локальной разработки)
# SESSION_SECRET - любой уникальный ключ
```

#### 2. Запуск приложения

```bash
npm start
```

Приложение будет доступно на `http://localhost:3000`

### В Docker

#### Быстрый старт

```bash
# Скопируй конфигурацию
cp .env.example .env

# Запусти контейнер
docker-compose up -d

# Просмотр логов
docker-compose logs -f tga_app
```

#### Остановка

```bash
docker-compose down
```

#### Перестройка образа

```bash
docker-compose up -d --build
```

## ⚙️ Конфигурация

### Переменные окружения (`.env`)

```env
# OIDC Аутентификация (Authentik)
OIDC_ISSUER=https://auth.example.com/application/o/tga/
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
REDIRECT_URI=http://localhost:3000/auth/callback

# Сессия
SESSION_SECRET=your-super-secret-key-min-32-chars

# Окружение (development/production)
NODE_ENV=development
```

### Структура JSON чата (`result.json`)

Каждый чат должен содержать файл `result.json` с следующей структурой:

```json
{
  "name": "Chat Name",
  "type": "personal_chat",
  "avatar_url": "photos/avatar.jpg",
  "id": 123456789,
  "groupNeed": "users",  // Опционально: требуемая группа или "anonymous"
  "messages": [
    {
      "id": 1,
      "type": "message",
      "date": "2026-03-24T20:43:25",
      "from": "User Name",
      "text": "Message text",
      "censored": true  // Сообщение отмечено как цензурированное
    }
  ]
}
```

### Значения `groupNeed`

| Значение | Поведение |
|----------|-----------|
| Не указано | Чат открыт для всех (не требуется аутентификация) |
| `"anonymous"` | Чат открыт для всех (явно указано) |
| `"groupName"` | Требуется группа `tga_group_groupName` в Authentik |

### Настройка Authentik

1. **Создай приложение OIDC:**
   - Перейди в Authentik > Applications
   - Создай новое приложение типа "OpenID Connect"
   - Установи Redirect URI: `http://localhost:3000/auth/callback`

2. **Получи credentials:**
   - Client ID (из деталей приложения)
   - Client Secret (из деталей приложения)

3. **Настрой groups scope:**
   - В приложении добавь scope `groups`
   - Это позволит приложению получать информацию о группах пользователя

4. **Создай группы:**
   - Создай группы названиями `tga_group_users`, `tga_group_admins` и т.д.
   - Добавь пользователей в нужные группы

## 📁 Структура проекта

```
TGArchive/
├── app/
│   ├── server.js              # Основной сервер Express
│   ├── package.json           # Зависимости проекта
│   ├── .env.example           # Пример конфигурации
│   ├── .env                   # Конфигурация (в .gitignore)
│   ├── Dockerfile             # Docker конфигурация
│   ├── docker-compose.yml     # Docker Compose конфигурация
│   ├── nginx.conf             # Nginx конфигурация для production
│   ├── chats_data/            # Директория с экспортированными чатами
│   │   └── ChatName/
│   │       ├── result.json    # Метаданные и сообщения чата
│   │       ├── photos/        # Фотографии
│   │       ├── videos/        # Видео файлы
│   │       ├── voice_messages/# Голосовые сообщения
│   │       └── stickers/      # Стикеры
│   └── views/                 # EJS шаблоны
│       ├── chat.ejs           # Страница чата
│       ├── list.ejs           # Список чатов
│       ├── error-403.ejs      # Ошибка доступа запрещен
│       ├── error-404.ejs      # Ошибка не найдено
│       └── error-500.ejs      # Ошибка сервера
└── .github/
    └── workflows/
        └── docker-build.yml   # GitHub Actions для build/push образа
```

## 🔌 API

### Маршруты

#### `GET /`
Список всех доступных чатов. Показывает статус доступа для каждого чата.
- **Аутентификация:** Нет требуется
- **Ответ:** HTML страница со списком чатов

#### `GET /chat/:id`
Просмотр конкретного чата.
- **Параметры:** `:id` - ID чата из `result.json`
- **Аутентификация:** Может требоваться (зависит от `groupNeed`)
- **Ответ:** HTML страница с сообщениями чата

#### `GET /auth/login`
Инициировать OIDC аутентификацию.
- **Редирект:** На OIDC провайдера
- **Ответ:** Редирект на `/auth/callback`

#### `GET /auth/callback`
Обработка callback от OIDC провайдера.
- **Параметры:** `code`, `state` (автоматически)
- **Ответ:** Редирект на `/` с установленной сессией

#### `GET /auth/logout`
Выход из системы.
- **Ответ:** Редирект на `/` с удаленной сессией

## 🐛 Troubleshooting

### Ошибка: "Invalid state" при OIDC

**Причина:** Несоответствие между протоколом REDIRECT_URI и фактическим протоколом.

**Решение:**
```bash
# Для локальной разработки (HTTP):
REDIRECT_URI=http://localhost:3000/auth/callback

# Для production (HTTPS):
REDIRECT_URI=https://tga.example.com/auth/callback
```

### Ошибка: "Requires login" для всех пользователей

**Причина:** Пользователь не имеет требуемую группу.

**Решение:**
1. Проверь значение `groupNeed` в `result.json` чата
2. Убедись что пользователь добавлен в группу `tga_group_{groupName}`
3. Проверь что Authentik возвращает группы в OIDC scope

### Docker контейнер не запускается

**Причина:** Отсутствуют переменные окружения.

**Решение:**
```bash
# Убедись что .env существует
ls -la .env

# Проверь логи
docker-compose logs tga_app

# Пересоздай контейнер
docker-compose down
docker-compose up -d
```

### Чаты не видны в списке

**Причина:** Структура папок неверна.

**Решение:**
```bash
# Правильная структура:
chats_data/
└── ChatName/
    └── result.json

# Проверь что result.json содержит необходимые поля:
cat chats_data/ChatName/result.json | head -20
```

### Health check fails в Docker

**Причина:** Приложение не ответило на health check.

**Решение:**
```bash
# Вручную проверь доступность
docker-compose exec tga_app wget --verbose http://localhost:3000/

# Если результат 200 OK - контейнер работает
```

## 🔒 Безопасность

- Приложение работает от non-root пользователя в Docker (`nodejs`)
- Используется `httpOnly` флаг для сессион cookies
- Поддерживается HTTPS в production (через reverse proxy)
- Graceful shutdown обрабатывает сигналы от Docker/Kubernetes

## 📝 Примеры

### Экспорт чата из Telegram Desktop

1. Открой чат в Telegram Desktop
2. Нажми на иконку настроек (⚙️)
3. Выбери "Export chat history"
4. Выбери "Machine-readable JSON" как медиа тип
5. Экспортированная папка будет скопирована в `chats_data/`

### Создание локально для разработки

```bash
# 1. Установи зависимости
npm install

# 2. Создай .env для development
cat > .env << EOF
OIDC_ISSUER=http://localhost:9000/application/o/tga/
OIDC_CLIENT_ID=test-client
OIDC_CLIENT_SECRET=test-secret
REDIRECT_URI=http://localhost:3000/auth/callback
SESSION_SECRET=test-secret-key-for-development
NODE_ENV=development
EOF

# 3. Запусти сервер
npm start

# 4. Открой http://localhost:3000 в браузере
```

## 📜 Лицензия

MIT License - смотри [LICENSE](LICENSE) файл для деталей.

## 🤝 Содействие

Доклады об ошибках и pull requests приветствуются!

## 📞 Поддержка

Если у тебя возникли проблемы, создай issue в GitHub с подробным описанием проблемы и логами.
