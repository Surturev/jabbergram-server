const router = require('express').Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

function generateToken(userId) {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '24h' });
}

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

router.post('/register', async (req, res) => {
    try {
        const { username, password, email, phone, firstName, lastName } = req.body;
        const existingUser = await User.findOne({ $or: [{ username }, { email }, { phone }] });
        if (existingUser) return res.status(400).json({ error: 'Пользователь уже существует' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            username,
            password: hashedPassword,
            email,
            phone,
            firstName: firstName || '',
            lastName: lastName || '',
            displayName: `${firstName} ${lastName}`.trim() || username
        });

        const savedUser = await newUser.save();
        const token = generateToken(savedUser._id);

        res.status(201).json({
            token,
            userId: savedUser._id,
            username: savedUser.username,
            displayName: savedUser.displayName
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { username, password, twoFactorCode } = req.body;
        
        // Allow login by username, email, phone, OR display name
        const user = await User.findOne({
            $or: [
                { username: username },
                { username: username.toLowerCase().replace(/ /g, '_') },
                { email: username },
                { phone: username },
                { displayName: { $regex: new RegExp('^' + username + '$', 'i') } }
            ]
        });

        if (!user) return res.status(400).json({ error: 'Пользователь не найден' });
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Неверный пароль' });

        // 2FA check (simplified for now, mostly disabled in DB)
        if (user.twoFactorEnabled) {
            if (!twoFactorCode) return res.status(400).json({ error: 'Требуется код 2FA' });
            if (twoFactorCode !== user.twoFactorSecret) return res.status(400).json({ error: 'Неверный код 2FA' });
        }

        user.lastSeen = new Date();
        await user.save();

        const token = generateToken(user._id);
        res.json({
            token,
            userId: user._id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            requires2FA: false
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/login-by-phone', async (req, res) => {
    try {
        const { phone } = req.body;
        const user = await User.findOne({ phone });
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        user.twoFactorSecret = otpCode;
        await user.save();

        res.json({ message: 'OTP отправлен', otp: otpCode });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password -twoFactorSecret');
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
