const router = require('express').Router();
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
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

router.get('/', authMiddleware, async (req, res) => {
    try {
        const conversations = await Conversation.find({ participants: req.userId })
            .sort({ lastMessageAt: -1 })
            .populate('participants', 'username displayName avatarUrl')
            .populate('lastMessage');
        res.json(conversations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/private', authMiddleware, async (req, res) => {
    try {
        const { otherUserId } = req.body;
        let conversation = await Conversation.findOne({
            type: 'private',
            participants: { $all: [req.userId, otherUserId] }
        }).populate('participants', 'username displayName avatarUrl');

        if (!conversation) {
            conversation = new Conversation({
                type: 'private',
                participants: [req.userId, otherUserId]
            });
            await conversation.save();
            conversation = await conversation.populate('participants', 'username displayName avatarUrl');
        }
        res.status(201).json(conversation);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/group', authMiddleware, async (req, res) => {
    try {
        const { name, description, participantIds } = req.body;
        const conversation = new Conversation({
            type: 'group',
            name,
            description: description || '',
            participants: [req.userId, ...(participantIds || [])],
            createdBy: req.userId,
            admins: [req.userId]
        });
        await conversation.save();
        const populated = await conversation.populate('participants', 'username displayName avatarUrl');
        res.status(201).json(populated);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/group/:id/add', authMiddleware, async (req, res) => {
    try {
        const { userIds } = req.body;
        const conversation = await Conversation.findById(req.params.id);
        if (!conversation) return res.status(404).json({ error: 'Чат не найден' });
        if (!conversation.admins.includes(req.userId)) return res.status(403).json({ error: 'Нет прав' });

        conversation.participants.push(...userIds);
        await conversation.save();
        res.json(conversation);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/group/:id/remove', authMiddleware, async (req, res) => {
    try {
        const { userIds } = req.body;
        const conversation = await Conversation.findById(req.params.id);
        if (!conversation) return res.status(404).json({ error: 'Чат не найден' });
        conversation.participants = conversation.participants.filter(p => !userIds.includes(p.toString()));
        await conversation.save();
        res.json(conversation);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { name, description, avatarUrl, folder, isMuted, isPinned } = req.body;
        const update = {};
        if (name !== undefined) update.name = name;
        if (description !== undefined) update.description = description;
        if (avatarUrl !== undefined) update.avatarUrl = avatarUrl;
        if (folder !== undefined) update.folder = folder;
        if (isMuted !== undefined) update.isMuted = isMuted;
        if (isPinned !== undefined) update.isPinned = isPinned;

        const conversation = await Conversation.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
        res.json(conversation);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const conversation = await Conversation.findById(req.params.id);
        if (!conversation) return res.status(404).json({ error: 'Чат не найден' });
        if (conversation.createdBy.toString() !== req.userId) return res.status(403).json({ error: 'Нет прав' });

        await Message.deleteMany({ conversationId: req.params.id });
        await conversation.deleteOne();
        res.json({ message: 'Чат удалён' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
