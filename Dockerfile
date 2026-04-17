# Multi-stage build для оптимизации размера образа
FROM node:20-alpine AS dependencies

WORKDIR /app

# Копируем только package files для кеширования слоев
COPY package*.json ./

# Установка dependencies с --production флагом для development stage
RUN npm ci --only=production && \
    npm cache clean --force

# ============================================
# Production stage
FROM node:20-alpine

# Установка dumb-init для правильной обработки сигналов
RUN apk add --no-cache dumb-init

WORKDIR /app

# Создаем неprivileged user для безопасности
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Копируем node_modules из dependencies stage
COPY --from=dependencies /app/node_modules ./node_modules

# Копируем приложение
COPY --chown=nodejs:nodejs . .

# Устанавливаем правильное окружение
ENV NODE_ENV=production

# Открываем порт
EXPOSE 3000

# Health check для docker-compose и orchestration
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Переходим на nodejs user
USER nodejs

# Используем dumb-init для правильной обработки сигналов
ENTRYPOINT ["dumb-init", "--"]

# Запускаем приложение
CMD ["node", "server.js"]
