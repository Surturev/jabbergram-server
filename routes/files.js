const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const File = require('../models/File');
const jwt = require('jsonwebtoken');

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|mp4|mp3|wav|ogg|zip|txt/;
        const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        cb(null, ext);
    }
});

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

router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });

        const fileUrl = `/uploads/${req.file.filename}`;
        const newFile = new File({
            owner: req.userId,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
            fileUrl,
            conversationId: req.body.conversationId || null,
            isAvatar: req.body.isAvatar === 'true'
        });
        await newFile.save();

        res.status(201).json({ fileUrl, fileId: newFile._id, fileName: req.file.originalname, fileSize: req.file.size, mimeType: req.file.mimetype });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/upload-avatar', authMiddleware, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
        const fileUrl = `/uploads/${req.file.filename}`;

        const User = require('../models/User');
        await User.findByIdAndUpdate(req.userId, { avatarUrl: fileUrl });

        res.status(201).json({ fileUrl });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/uploads/:filename', (req, res) => {
    const filePath = path.join(uploadsDir, req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Файл не найден' });
    res.sendFile(filePath);
});

router.get('/cloud-storage', authMiddleware, async (req, res) => {
    try {
        const files = await File.find({ owner: req.userId, isAvatar: false })
            .sort({ uploadedAt: -1 })
            .limit(100);
        res.json(files);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
