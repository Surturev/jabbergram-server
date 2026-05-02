const router = require('express').Router();
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const jwt = require('jsonwebtoken');

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

router.get('/:conversationId', authMiddleware, async (req, res) => {
    try {
        const { limit = 50, before } = req.query;
        const query = { conversationId: req.params.conversationId, isDeleted: false };
        if (before) query.createdAt = { $lt: new Date(before) };

        const messages = await Message.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .populate('sender', 'username displayName avatarUrl')
            .populate('replyTo');

        res.json(messages.reverse());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { text } = req.body;
        const message = await Message.findById(req.params.id);
        if (!message) return res.status(404).json({ error: 'Сообщение не найдено' });
        if (message.sender.toString() !== req.userId) return res.status(403).json({ error: 'Нет прав' });
        if (message.isDeleted) return res.status(400).json({ error: 'Сообщение удалено' });

        message.text = text;
        message.isEdited = true;
        await message.save();
        res.json(message);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const { deleteForAll } = req.query;
        const message = await Message.findById(req.params.id);
        if (!message) return res.status(404).json({ error: 'Сообщение не найдено' });
        if (message.sender.toString() !== req.userId) return res.status(403).json({ error: 'Нет прав' });

        if (deleteForAll === 'true') {
            message.isDeleted = true;
        } else {
            message.deletedFor.push(req.userId);
        }
        await message.save();
        res.json(message);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/:id/read', authMiddleware, async (req, res) => {
    try {
        const message = await Message.findById(req.params.id);
        if (!message) return res.status(404).json({ error: 'Сообщение не найдено' });
        if (!message.readBy.includes(req.userId)) {
            message.readBy.push(req.userId);
            await message.save();
        }
        res.json(message);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/:id/reaction', authMiddleware, async (req, res) => {
    try {
        const { emoji } = req.body;
        const message = await Message.findById(req.params.id);
        if (!message) return res.status(404).json({ error: 'Сообщение не найдено' });

        const existingIdx = message.reactions.findIndex(r => r.userId.toString() === req.userId);
        if (existingIdx >= 0) {
            if (message.reactions[existingIdx].emoji === emoji) {
                message.reactions.splice(existingIdx, 1);
            } else {
                message.reactions[existingIdx].emoji = emoji;
            }
        } else {
            message.reactions.push({ userId: req.userId, emoji });
        }

        await message.save();
        const populated = await message.populate('reactions.userId', 'username displayName avatarUrl');
        res.json({ message: 'Реакция обновлена', reactions: message.reactions });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/forward', authMiddleware, async (req, res) => {
    try {
        const { messageId, targetConversationId } = req.body;
        const original = await Message.findById(messageId).populate('sender', 'username displayName');
        if (!original) return res.status(404).json({ error: 'Сообщение не найдено' });

        const forward = new Message({
            conversationId: targetConversationId,
            sender: req.userId,
            text: original.text,
            messageType: original.messageType,
            fileUrl: original.fileUrl,
            fileName: original.fileName,
            fileSize: original.fileSize,
            stickerUrl: original.stickerUrl,
            voiceDuration: original.voiceDuration,
            forwardedFrom: original.sender._id,
            forwardedMessageId: original._id
        });

        await forward.save();
        await Conversation.findByIdAndUpdate(targetConversationId, {
            lastMessage: forward.text || '[Пересланное]',
            lastMessageAt: new Date()
        });

        const populated = await forward.populate('sender', 'username displayName avatarUrl');
        res.status(201).json(populated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/forward-targets', authMiddleware, async (req, res) => {
    try {
        const conversations = await Conversation.find({ participants: req.userId })
            .sort({ lastMessageAt: -1 })
            .populate('participants', 'username displayName avatarUrl')
            .limit(50);
        res.json(conversations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/delete-auto', async () => {
    const now = new Date();
    await Message.deleteMany({ autoDeleteAt: { $lte: now } });
});

module.exports = router;
