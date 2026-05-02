const router = require('express').Router();
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const jwt = require('jsonwebtoken');
const https = require('https');

function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Нет токена' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.id;
        next();
    } catch (e) {
        res.status(401).json({ error: 'Неверный токен' });
    }
}

// Conversation history storage (in-memory, per user)
const chatHistories = new Map();

const SYSTEM_PROMPT = `Ты — DeepSeek AI, интеллектуальный ассистент, встроенный в мессенджер Jabbergram.

Твои правила:
- Отвечай на русском языке (если пользователь пишет на другом — отвечай на том же языке)
- Будь краток и понятен (1-3 абзаца, если не просят подробнее)
- Используй эмодзи умеренно
- Помогай с кодом, учёбой, идеями, переводами, советами
- Если не знаешь — честно скажи
- Форматируй код в блоки с указанием языка
- Не представляйся как ChatGPT или другая модель — ты DeepSeek AI ассистент в Jabbergram`;

async function callDeepSeekAPI(messages) {
    return new Promise((resolve, reject) => {
        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey) {
            return reject(new Error('DEEPSEEK_API_KEY не настроен'));
        }

        const postData = JSON.stringify({
            model: 'deepseek-chat',
            messages: messages,
            max_tokens: 2000,
            temperature: 0.7
        });

        const options = {
            hostname: 'api.deepseek.com',
            path: '/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (response) => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.choices && parsed.choices[0] && parsed.choices[0].message) {
                        resolve(parsed.choices[0].message.content.trim());
                    } else if (parsed.error) {
                        reject(new Error(`DeepSeek API: ${parsed.error.message}`));
                    } else {
                        reject(new Error('Unexpected API response'));
                    }
                } catch (e) {
                    reject(new Error('Failed to parse API response'));
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('Превышено время ожидания'));
        });
        req.write(postData);
        req.end();
    });
}

router.post('/chat', authMiddleware, async (req, res) => {
    try {
        const { message, conversationId } = req.body;
        if (!message) return res.status(400).json({ error: 'Нет сообщения' });

        // Get or create conversation history
        const userId = req.userId;
        if (!chatHistories.has(userId)) {
            chatHistories.set(userId, []);
        }
        const history = chatHistories.get(userId);

        // Add user message to history
        history.push({ role: 'user', content: message });

        // Keep last 20 messages to stay within token limits
        if (history.length > 20) {
            history.splice(0, history.length - 20);
        }

        // Build full messages array with system prompt
        const apiMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...history
        ];

        let aiResponse;
        try {
            aiResponse = await callDeepSeekAPI(apiMessages);
        } catch (apiErr) {
            console.error('DeepSeek API error:', apiErr.message);
            aiResponse = `⚠️ Ошибка AI: ${apiErr.message}\n\nПопробуйте позже.`;
        }

        // Add AI response to history
        history.push({ role: 'assistant', content: aiResponse });

        // Save AI message to DB
        const aiMsg = new Message({
            conversationId,
            sender: req.userId,
            text: aiResponse,
            messageType: 'text',
            createdAt: new Date()
        });

        await aiMsg.save();

        const populated = await Message.findById(aiMsg._id).populate('sender', 'username displayName avatarUrl');

        res.json({
            _id: populated._id,
            text: populated.text,
            messageType: populated.messageType,
            createdAt: populated.createdAt,
            sender: { _id: 'ai_bot', displayName: 'DeepSeek AI', avatarUrl: '' }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/conversation', authMiddleware, async (req, res) => {
    try {
        let conversation = await Conversation.findOne({ type: 'bot', participants: req.userId });

        if (!conversation) {
            conversation = new Conversation({
                type: 'bot',
                name: 'DeepSeek AI',
                description: 'Умный AI-ассистент на базе DeepSeek',
                avatarUrl: '/uploads/bot_avatar.png',
                participants: [req.userId]
            });
            await conversation.save();

            const welcomeMsg = new Message({
                conversationId: conversation._id,
                sender: req.userId,
                text: '👋 Привет! Я DeepSeek AI — ваш умный ассистент в Jabbergram.\n\nЯ могу:\n• Отвечать на любые вопросы\n• Помогать с кодом\n• Объяснять сложные темы\n• Переводить тексты\n• Генерировать идеи\n• И многое другое\n\nПросто напишите что-нибудь! 🚀',
                messageType: 'text'
            });
            await welcomeMsg.save();

            // Initialize chat history
            chatHistories.set(req.userId, []);
        }

        res.json(conversation);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/clear-history', authMiddleware, async (req, res) => {
    try {
        chatHistories.delete(req.userId);
        res.json({ message: 'История очищена' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/messages/:conversationId', authMiddleware, async (req, res) => {
    try {
        const messages = await Message.find({ conversationId: req.params.conversationId })
            .sort({ createdAt: 1 })
            .limit(100);
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
