const router = require('express').Router();
const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const jwt = require('jsonwebtoken');

function adminMiddleware(req, res, next) {
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

async function checkAdmin(userId, res) {
    const user = await User.findById(userId);
    if (!user || !user.isAdmin) {
        res.status(403).json({ error: 'Только для администраторов' });
        return null;
    }
    return user;
}

// Stats
router.get('/stats', adminMiddleware, async (req, res) => {
    const admin = await checkAdmin(req.userId, res);
    if (!admin) return;

    try {
        const totalUsers = await User.countDocuments();
        const onlineUsers = await User.countDocuments({ isOnline: true });
        const premiumUsers = await User.countDocuments({ premium: true });
        const vipUsers = await User.countDocuments({ isVip: true });
        const totalMessages = await Message.countDocuments();
        const totalConversations = await Conversation.countDocuments();
        const bannedUsers = await User.countDocuments({ isBanned: true });

        const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5)
            .select('username displayName avatarUrl isVerified premium isVip isAdmin createdAt');

        res.json({
            totalUsers, onlineUsers, premiumUsers, vipUsers,
            totalMessages, totalConversations, bannedUsers,
            recentUsers
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Search users
router.get('/users', adminMiddleware, async (req, res) => {
    const admin = await checkAdmin(req.userId, res);
    if (!admin) return;

    try {
        const { query, page = 1, limit = 20 } = req.query;
        const filter = {};
        if (query) {
            filter.$or = [
                { username: { $regex: query, $options: 'i' } },
                { displayName: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } }
            ];
        }

        const users = await User.find(filter)
            .select('-password -twoFactorSecret')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

        const total = await User.countDocuments(filter);
        res.json({ users, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get user details
router.get('/users/:id', adminMiddleware, async (req, res) => {
    const admin = await checkAdmin(req.userId, res);
    if (!admin) return;

    try {
        const user = await User.findById(req.params.id).select('-password -twoFactorSecret');
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Toggle admin
router.put('/users/:id/toggle-admin', adminMiddleware, async (req, res) => {
    const admin = await checkAdmin(req.userId, res);
    if (!admin) return;

    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

        user.isAdmin = !user.isAdmin;
        await user.save();
        res.json({ message: user.isAdmin ? 'Админка выдана' : 'Админка снята', isAdmin: user.isAdmin });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Toggle premium
router.put('/users/:id/toggle-premium', adminMiddleware, async (req, res) => {
    const admin = await checkAdmin(req.userId, res);
    if (!admin) return;

    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

        const { expiresAt } = req.body;
        user.premium = !user.premium;
        user.premiumExpiresAt = expiresAt ? new Date(expiresAt) : (user.premium ? null : null);
        await user.save();
        res.json({ message: user.premium ? 'Премиум выдан' : 'Премиум снят', premium: user.premium });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Toggle VIP
router.put('/users/:id/toggle-vip', adminMiddleware, async (req, res) => {
    const admin = await checkAdmin(req.userId, res);
    if (!admin) return;

    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

        const { expiresAt, level } = req.body;
        user.isVip = !user.isVip;
        user.vipExpiresAt = expiresAt ? new Date(expiresAt) : (user.isVip ? null : null);
        if (level) user.vipLevel = parseInt(level);
        await user.save();
        res.json({ message: user.isVip ? 'VIP выдан' : 'VIP снят', isVip: user.isVip });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Toggle verified badge
router.put('/users/:id/toggle-verified', adminMiddleware, async (req, res) => {
    const admin = await checkAdmin(req.userId, res);
    if (!admin) return;

    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

        user.isVerified = !user.isVerified;
        await user.save();
        res.json({ message: user.isVerified ? 'Верификация выдана' : 'Верификация снята', isVerified: user.isVerified });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Ban/unban user
router.put('/users/:id/toggle-ban', adminMiddleware, async (req, res) => {
    const admin = await checkAdmin(req.userId, res);
    if (!admin) return;

    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
        if (user.isAdmin) return res.status(400).json({ error: 'Нельзя забанить админа' });

        const { reason } = req.body;
        user.isBanned = !user.isBanned;
        user.banReason = user.isBanned ? (reason || 'Нарушение правил') : '';
        user.bannedAt = user.isBanned ? new Date() : null;
        await user.save();
        res.json({ message: user.isBanned ? 'Пользователь забанен' : 'Пользователь разбанен', isBanned: user.isBanned });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add jabbers
router.put('/users/:id/add-jabbers', adminMiddleware, async (req, res) => {
    const admin = await checkAdmin(req.userId, res);
    if (!admin) return;

    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

        const { amount } = req.body;
        if (!amount || parseInt(amount) === 0) return res.status(400).json({ error: 'Укажите сумму' });

        user.jabbersBalance = (user.jabbersBalance || 0) + parseInt(amount);
        await user.save();
        res.json({ message: `Добавлено ${amount} jabbers`, newBalance: user.jabbersBalance });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Set jabbers balance directly
router.put('/users/:id/set-jabbers', adminMiddleware, async (req, res) => {
    const admin = await checkAdmin(req.userId, res);
    if (!admin) return;

    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

        const { amount } = req.body;
        user.jabbersBalance = parseInt(amount);
        await user.save();
        res.json({ message: 'Баланс установлен', newBalance: user.jabbersBalance });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Set bio
router.put('/users/:id/set-bio', adminMiddleware, async (req, res) => {
    const admin = await checkAdmin(req.userId, res);
    if (!admin) return;

    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

        const { bio } = req.body;
        user.bio = bio || '';
        await user.save();
        res.json({ message: 'Описание обновлено' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete user
router.delete('/users/:id', adminMiddleware, async (req, res) => {
    const admin = await checkAdmin(req.userId, res);
    if (!admin) return;

    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
        if (user.isAdmin) return res.status(400).json({ error: 'Нельзя удалить админа' });

        await User.findByIdAndDelete(req.params.id);
        res.json({ message: 'Пользователь удалён' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Global broadcast (send message to all users)
router.post('/broadcast', adminMiddleware, async (req, res) => {
    const admin = await checkAdmin(req.userId, res);
    if (!admin) return;

    try {
        const { text, title } = req.body;
        if (!text) return res.status(400).json({ error: 'Укажите текст' });

        const allUsers = await User.find({}, '_id');
        res.json({ message: `Рассылка подготовлена для ${allUsers.length} пользователей`, count: allUsers.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update display name
router.put('/users/:id/set-display-name', adminMiddleware, async (req, res) => {
    const admin = await checkAdmin(req.userId, res);
    if (!admin) return;

    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

        const { displayName } = req.body;
        user.displayName = displayName;
        await user.save();
        res.json({ message: 'Имя обновлено' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/stats', adminMiddleware, async (req, res) => {
    try {
        const userCount = await User.countDocuments();
        const convCount = await Conversation.countDocuments();
        const msgCount = await Message.countDocuments();
        res.json({ users: userCount, conversations: convCount, messages: msgCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/clean-users', adminMiddleware, async (req, res) => {
    try {
        const { keepUsername } = req.body;
        if (!keepUsername) return res.status(400).json({ error: 'Укажи username' });

        const keeper = await User.findOne({ username: { $regex: new RegExp('^' + keepUsername + '$', 'i') } });
        if (!keeper) return res.status(404).json({ error: 'Юзер не найден' });

        const deleted = await User.deleteMany({ _id: { $ne: keeper._id } });
        await Conversation.deleteMany({ participants: { $ne: keeper._id } });

        const convIds = await Conversation.find({}, '_id').then(cs => cs.map(c => c._id));
        await Message.deleteMany({ conversationId: { $nin: convIds } });

        res.json({ message: `Удалено ${deleted.deletedCount} юзеров`, deletedCount: deleted.deletedCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
