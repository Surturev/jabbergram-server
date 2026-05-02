const router = require('express').Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
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

router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password -twoFactorSecret');
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).select('-password -twoFactorSecret -email');
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/update', authMiddleware, async (req, res) => {
    try {
        const { firstName, lastName, bio, displayName, avatarUrl, accentColor, settings } = req.body;
        const update = {};
        if (firstName !== undefined) update.firstName = firstName;
        if (lastName !== undefined) update.lastName = lastName;
        if (bio !== undefined) update.bio = bio;
        if (displayName !== undefined) update.displayName = displayName;
        if (avatarUrl !== undefined) update.avatarUrl = avatarUrl;
        if (accentColor !== undefined) update.accentColor = accentColor;
        if (settings) update.settings = { ...update.settings, ...settings };

        const user = await User.findByIdAndUpdate(req.userId, { $set: update }, { new: true }).select('-password -twoFactorSecret');
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/username', authMiddleware, async (req, res) => {
    try {
        const { username } = req.body;
        if (!username || username.length < 3) {
            return res.status(400).json({ error: 'Минимум 3 символа' });
        }

        const existing = await User.findOne({ username: username.toLowerCase(), _id: { $ne: req.userId } });
        if (existing) {
            return res.status(400).json({ error: 'Это имя пользователя уже занято' });
        }

        const user = await User.findByIdAndUpdate(req.userId,
            { username: username.toLowerCase() },
            { new: true }
        ).select('-password -twoFactorSecret');
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/change-password', authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.userId);
        const valid = await bcrypt.compare(currentPassword, user.password);
        if (!valid) return res.status(400).json({ error: 'Неверный текущий пароль' });

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();
        res.json({ message: 'Пароль изменён' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/enable-2fa', authMiddleware, async (req, res) => {
    try {
        const { code } = req.body;
        const user = await User.findById(req.userId);
        user.twoFactorSecret = code || Math.floor(100000 + Math.random() * 900000).toString();
        user.twoFactorEnabled = true;
        await user.save();
        res.json({ message: '2FA включён', secret: user.twoFactorSecret });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/disable-2fa', authMiddleware, async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.userId, {
            twoFactorEnabled: false,
            twoFactorSecret: ''
        });
        res.json({ message: '2FA отключён' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/create-profile', authMiddleware, async (req, res) => {
    try {
        const { name, bio, avatarUrl } = req.body;
        const user = await User.findById(req.userId);
        for (const p of user.profiles) p.isActive = false;
        user.profiles.push({ name, bio, avatarUrl, isActive: true });
        await user.save();
        res.json({ message: 'Профиль создан', profiles: user.profiles });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/switch-profile', authMiddleware, async (req, res) => {
    try {
        const { profileIndex } = req.body;
        const user = await User.findById(req.userId);
        if (!user.profiles[profileIndex]) return res.status(404).json({ error: 'Профиль не найден' });
        for (const p of user.profiles) p.isActive = false;
        user.profiles[profileIndex].isActive = true;
        await user.save();
        res.json({ message: 'Профиль переключён', activeProfile: user.profiles[profileIndex] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/contacts', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId).populate('contacts', 'username displayName avatarUrl');
        res.json(user.contacts || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/sync-contacts', authMiddleware, async (req, res) => {
    try {
        const { contacts } = req.body;
        const users = await User.find({ phone: { $in: contacts } }).select('_id username displayName avatarUrl');
        await User.findByIdAndUpdate(req.userId, { $addToSet: { contacts: { $each: users.map(u => u._id) } } });
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/folders', authMiddleware, async (req, res) => {
    try {
        const { folders } = req.body;
        const user = await User.findByIdAndUpdate(req.userId, { $set: { chatFolders: folders } }, { new: true }).select('chatFolders');
        res.json(user.chatFolders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/search', async (req, res) => {
    try {
        const { query } = req.query;
        const users = await User.find({
            $or: [
                { username: { $regex: query, $options: 'i' } },
                { displayName: { $regex: query, $options: 'i' } }
            ]
        }).select('_id username displayName avatarUrl bio');
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/me', authMiddleware, async (req, res) => {
    try {
        await User.findByIdAndDelete(req.userId);
        res.json({ message: 'Аккаунт удалён' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
