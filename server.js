require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const { Issuer } = require('openid-client');

const app = express();

const CHATS_DIR = path.join(__dirname, 'chats_data');

// Переменные окружения для OIDC
const OIDC_ISSUER = process.env.OIDC_ISSUER || 'https://authentik.example.com/application/o/oidc/';
const OIDC_CLIENT_ID = process.env.OIDC_CLIENT_ID || 'your-client-id';
const OIDC_CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET || 'your-client-secret';
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3000/auth/callback';

let oidcClient;

// Инициализация OIDC клиента
async function initOIDC() {
    try {
        const issuer = await Issuer.discover(OIDC_ISSUER);
        oidcClient = new issuer.Client({
            client_id: OIDC_CLIENT_ID,
            client_secret: OIDC_CLIENT_SECRET,
            redirect_uris: [REDIRECT_URI],
            response_types: ['code'],
        });
    } catch (err) {
    }
}

initOIDC();

// Настройка сессии
const isProduction = process.env.NODE_ENV === 'production';
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        // В production используем secure: true (требует HTTPS)
        // В development используем false для HTTP
        secure: isProduction,
        httpOnly: true,
        sameSite: 'Lax', // Разрешаем отправку cookie при редиректе
        maxAge: 24 * 60 * 60 * 1000 // 24 часа
    }
}));

app.set('view engine', 'ejs');
app.use('/media', express.static(CHATS_DIR));

// Маршрут входа
app.get('/auth/login', (req, res) => {
    if (!oidcClient) return res.status(500).send('OIDC не инициализирован');
    
    const state = Math.random().toString(36).substring(7);
    const nonce = Math.random().toString(36).substring(7);
    
    req.session.state = state;
    req.session.nonce = nonce;
    
    // Явно сохраняем сессию перед редиректом
    req.session.save((err) => {
        if (err) {
            return res.status(500).send('Session save failed');
        }
        
        const authorizationUrl = oidcClient.authorizationUrl({
            scope: 'openid profile email groups',
            state,
            nonce,
        });
        res.redirect(authorizationUrl);
    });
});

// Callback после входа
app.get('/auth/callback', async (req, res) => {
    if (!oidcClient) return res.status(500).send('OIDC не инициализирован');
    
    try {
        const params = oidcClient.callbackParams(req);
        
        if (!req.session.state) {
            return res.status(400).send('Invalid state: сессия потеряна');
        }
        
        if (params.state !== req.session.state) {
            return res.status(400).send('Invalid state: параметры не совпадают');
        }
        
        const tokenSet = await oidcClient.callback(REDIRECT_URI, params, { 
            state: req.session.state,
            nonce: req.session.nonce 
        });
        
        const userInfo = await oidcClient.userinfo(tokenSet);
        
        req.session.user = {
            id: userInfo.sub,
            email: userInfo.email,
            name: userInfo.name,
            groups: userInfo.groups || []
        };
        
        res.redirect('/');
    } catch (err) {
        res.status(400).send(`Authentication failed: ${err.message}`);
    }
});

// Маршрут выхода
app.get('/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).render('error-500', { error: err.message });
        }
        res.redirect('/');
    });
});

// Функция для фильтрации групп (показываем только tga_group_* без префикса)
const filterAppGroups = (groups) => {
    return (groups || [])
        .filter(g => g.startsWith('tga_group_'))
        .map(g => g.replace('tga_group_', ''));
};

// Функция проверки доступа пользователя к конкретному чату
const checkUserChatAccess = (user, groupNeed) => {
    // Если нет требований к группе или groupNeed = 'anonymous' - доступ открыт для всех
    if (!groupNeed || groupNeed === 'anonymous') {
        return { hasAccess: true };
    }
    
    // Для остальных групп требуется авторизация
    if (!user) {
        return { hasAccess: false, requiresLogin: true };
    }
    
    // Проверяем наличие требуемой группы
    const requiredGroup = `tga_group_${groupNeed}`;
    const userGroups = user.groups || [];
    
    if (!userGroups.includes(requiredGroup)) {
        return { hasAccess: false, requiredGroup: groupNeed };
    }
    
    return { hasAccess: true };
};

// Главная страница - список чатов (открытая)
app.get('/', (req, res) => {
    if (!fs.existsSync(CHATS_DIR)) return res.render('error-500', { error: 'Папка chats_data не найдена' });
    
    const folders = fs.readdirSync(CHATS_DIR).filter(f => fs.lstatSync(path.join(CHATS_DIR, f)).isDirectory());
    const user = req.session.user ? {
        ...req.session.user,
        groups: filterAppGroups(req.session.user.groups)
    } : null;
    
    const chats = folders.map(f => {
        try {
            const data = JSON.parse(fs.readFileSync(path.join(CHATS_DIR, f, 'result.json')));
            const accessCheck = checkUserChatAccess(req.session.user || null, data.groupNeed);
            
            return {
                id: f,
                name: data.name,
                avatar: data.avatar_url,
                hasAccess: accessCheck.hasAccess,
                requiresLogin: accessCheck.requiresLogin,
                requiresLogout: accessCheck.requiresLogout,
                requiredGroup: accessCheck.requiredGroup
            };
        } catch (e) { return null; }
    }).filter(Boolean);
    
    res.render('list', { 
        chats,
        user: user
    });
});

// Middleware проверки прав доступа к чату
const checkChatAccess = (req, res, next) => {
    const chatId = req.params.id;
    const jsonPath = path.join(CHATS_DIR, chatId, 'result.json');
    
    if (!fs.existsSync(jsonPath)) {
        return res.status(404).render('error-404');
    }
    
    try {
        const chatData = JSON.parse(fs.readFileSync(jsonPath));
        
        // Проверяем доступ с использованием единой функции
        const accessCheck = checkUserChatAccess(req.session.user || null, chatData.groupNeed);
        
        // Сохраняем данные в req для использования в маршруте
        req.chatData = { chatData, accessCheck };
        
        // Если требуется логин
        if (accessCheck.requiresLogin) {
            return res.redirect('/auth/login');
        }
        
        // Если нет доступа из-за группы
        if (!accessCheck.hasAccess && accessCheck.requiredGroup) {
            return res.status(403).render('error-403', {
                requiredGroup: chatData.groupNeed,
                userGroups: filterAppGroups(req.session.user ? req.session.user.groups : [])
            });
        }
        
        // Доступ разрешен
        if (!accessCheck.hasAccess) {
            return res.status(403).render('error-403', { requiredGroup: 'Неизвестно' });
        }
        
        next();
    } catch (err) {
        res.status(500).render('error-500', { error: err.message });
    }
};

// Маршрут чата с проверкой доступа
app.get('/chat/:id', checkChatAccess, (req, res) => {
    const chatId = req.params.id;
    const data = req.chatData.chatData;
    
    // Фильтруем группы пользователя
    const user = req.session.user ? {
        ...req.session.user,
        groups: filterAppGroups(req.session.user.groups)
    } : null;
    
    res.render('chat', { 
        chatId: chatId,
        chatName: data.name,
        messages: data.messages,
        myId: "user1476249335",
        users: data.users || [],
        user: user
    });
});

// Обработчик ошибок 404
app.use((req, res) => {
    res.status(404).render('error-404');
});

// Обработчик ошибок 500
app.use((err, req, res, next) => {
    console.error('Необработанная ошибка:', err);
    res.status(500).render('error-500', { error: err.message });
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    const env = process.env.NODE_ENV || 'development';
    console.log(`[${new Date().toISOString()}] Server started на http://localhost:${PORT} (${env} mode)`);
});

// Graceful shutdown для корректного завершения контейнера
const gracefulShutdown = (signal) => {
    console.log(`\n[${new Date().toISOString()}] ${signal} получен, закрываем соединения...`);
    server.close(() => {
        console.log(`[${new Date().toISOString()}] Server закрыт корректно`);
        process.exit(0);
    });
    
    // Принудительное завершение если server не закрывается
    setTimeout(() => {
        console.error(`[${new Date().toISOString()}] Server не закрылся за 10 секунд, принудительное завершение`);
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Обработка необработанных ошибок
process.on('uncaughtException', (err) => {
    console.error(`[${new Date().toISOString()}] Необработанное исключение:`, err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(`[${new Date().toISOString()}] Необработанный Promise rejection в:`, promise, 'причина:', reason);
    process.exit(1);
});