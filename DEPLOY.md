# Деплой Jabbergram на Render + MongoDB Atlas

## Шаг 1: MongoDB Atlas (бесплатная база данных)

1. Зайди на https://www.mongodb.com/cloud/atlas/register
2. Создай аккаунт (бесплатно)
3. Нажми "Build a Database" → выбери FREE (M0)
4. Выбери регион ближе к себе (например, AWS - Frankfurt)
5. Создай кластер
6. В разделе "Database Access" создай пользователя:
   - Username: `jabbergram`
   - Password: (запомни!)
7. В разделе "Network Access" добавь `0.0.0.0/0` (разрешить все IP)
8. Нажми "Connect" → "Connect your application"
9. Скопируй строку подключения, например:
   ```
   mongodb+srv://jabbergram:ПАРОЛЬ@cluster0.xxxxx.mongodb.net/messenger
   ```

## Шаг 2: Render (бесплатный хостинг)

1. Зайди на https://render.com
2. Зарегистрируйся через GitHub
3. Нажми "New +" → "Web Service"
4. Подключи репозиторий с сервером ИЛИ выбери "Deploy manually"
5. Настройки:
   - Name: `jabbergram-server`
   - Region: Frankfurt
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Plan: Free
6. Environment Variables:
   - `MONGO_URI` = строка подключения из MongoDB Atlas
   - `JWT_SECRET` = любой случайный текст (например: `my_super_secret_key_123`)
   - `NODE_ENV` = `production`
7. Нажми "Deploy"
8. Скопируй URL сервиса, например: `https://jabbergram-server.onrender.com`

## Шаг 3: Обновить Android приложение

В приложении при первом запуске введи новый URL сервера:
```
https://jabbergram-server.onrender.com
```

## Важно про Render Free

- Сервер засыпает через 15 минут без активности
- Первое подключение после сна занимает ~30 секунд
- 750 бесплатных часов в месяц (хватает на 24/7 один сервис)
- WebSocket поддерживается ✅

## Альтернативы Render

- Railway.app - $5 кредитов бесплатно
- Fly.io - 3 бесплатных VM
- Heroku - платный, от $5/мес
- VPS (Timeweb, Aeza) - от 150₽/мес, но стабильнее
