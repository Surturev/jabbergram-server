const router = require('express').Router();
const User = require('../models/User');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const emailCodes = new Map();

function getEmailTransporter() {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASSWORD
        }
    });
}

function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

router.post('/send-code', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'Неверный email' });
        }

        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(400).json({ error: 'Этот email уже зарегистрирован' });
        }

        const code = generateCode();
        emailCodes.set(email.toLowerCase(), { code, expires: Date.now() + 5 * 60 * 1000 });

        if (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
            try {
                const transporter = getEmailTransporter();
                await transporter.sendMail({
                    from: `"Jabbergram" <${process.env.EMAIL_USER}>`,
                    to: email,
                    subject: 'Код подтверждения Jabbergram',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto;">
                            <h2 style="color: #667eea;">Jabbergram</h2>
                            <p>Ваш код подтверждения:</p>
                            <h1 style="font-size: 36px; color: #667eea; letter-spacing: 8px;">${code}</h1>
                            <p style="color: #888;">Код действителен 5 минут.</p>
                            <p style="color: #888;">Если вы не регистрировались, проигнорируйте это письмо.</p>
                        </div>
                    `
                });
                console.log(`Email code sent to ${email}`);
            } catch (emailErr) {
                console.error('Email send error:', emailErr.message);
                emailCodes.delete(email.toLowerCase());
                return res.status(500).json({ error: 'Не удалось отправить email' });
            }
        } else {
            console.log(`DEV MODE: Email code for ${email}: ${code}`);
            return res.json({ message: 'Код отправлен', devCode: code });
        }

        res.json({ message: 'Код отправлен на ' + email });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/verify-code', async (req, res) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) {
            return res.status(400).json({ error: 'Email и код обязательны' });
        }

        const entry = emailCodes.get(email.toLowerCase());
        if (!entry) {
            return res.status(400).json({ error: 'Код не отправлен. Нажмите "Отправить код" снова' });
        }

        if (Date.now() > entry.expires) {
            emailCodes.delete(email.toLowerCase());
            return res.status(400).json({ error: 'Код истёк. Отправьте новый' });
        }

        if (entry.code !== code) {
            return res.status(400).json({ error: 'Неверный код' });
        }

        emailCodes.delete(email.toLowerCase());
        res.json({ message: 'Код подтверждён', email: email.toLowerCase() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/register', async (req, res) => {
    try {
        const { email, firstName, lastName, password } = req.body;

        if (!email || !firstName || !password) {
            return res.status(400).json({ error: 'Заполните все поля' });
        }

        if (password.length < 4) {
            return res.status(400).json({ error: 'Пароль минимум 4 символа' });
        }

        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(400).json({ error: 'Email уже зарегистрирован' });
        }

        const username = `${firstName}_${lastName || 'user'}`.toLowerCase().replace(/[^a-zа-яё0-9]/gi, '_').replace(/_+/g, '_');

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = new User({
            email: email.toLowerCase(),
            username,
            displayName: `${firstName} ${lastName || ''}`.trim(),
            firstName,
            lastName: lastName || '',
            password: hashedPassword
        });

        await user.save();

        const token = jwt.sign(
            { id: user._id.toString() },
            process.env.JWT_SECRET,
            { expiresIn: '90d' }
        );

        res.status(201).json({
            token,
            userId: user._id.toString(),
            username: user.username,
            displayName: user.displayName,
            email: user.email
        });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ error: 'Пользователь уже существует' });
        }
        res.status(500).json({ error: err.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email и пароль обязательны' });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(400).json({ error: 'Пользователь не найден' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Неверный пароль' });
        }

        const token = jwt.sign(
            { id: user._id.toString() },
            process.env.JWT_SECRET,
            { expiresIn: '90d' }
        );

        res.json({
            token,
            userId: user._id.toString(),
            username: user.username,
            displayName: user.displayName,
            email: user.email
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
