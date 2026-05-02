const router = require('express').Router();
const User = require('../models/User');
const Gift = require('../models/Gift');
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

router.get('/catalog', async (req, res) => {
    try {
        const gifts = await Gift.find().sort({ priceJabbers: 1 });
        res.json(gifts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/owned', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId).populate('ownedGifts.giftId');
        res.json(user.ownedGifts || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/buy', authMiddleware, async (req, res) => {
    try {
        const { giftId, recipientId } = req.body;
        const user = await User.findById(req.userId);
        const gift = await Gift.findOne({ giftId });

        if (!gift) return res.status(404).json({ error: 'Подарок не найден' });
        if (gift.remainingSupply <= 0) return res.status(400).json({ error: 'Подарок распродан' });
        if (user.jabbersBalance < gift.priceJabbers) return res.status(400).json({ error: 'Недостаточно Jabbers' });

        user.jabbersBalance -= gift.priceJabbers;
        gift.remainingSupply -= 1;
        gift.totalSupply += 1;

        if (!user.ownedGifts) user.ownedGifts = [];
        user.ownedGifts.push({
            giftId: gift._id,
            purchasedAt: new Date(),
            isSent: false
        });

        await user.save();
        await gift.save();

        res.json({ message: 'Подарок куплен', jabbersBalance: user.jabbersBalance });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/send', authMiddleware, async (req, res) => {
    try {
        const { giftIndex, recipientId } = req.body;
        const user = await User.findById(req.userId);
        const recipient = await User.findById(recipientId);

        if (!user.ownedGifts[giftIndex]) return res.status(404).json({ error: 'Подарок не найден' });
        if (user.ownedGifts[giftIndex].isSent) return res.status(400).json({ error: 'Подарок уже отправлен' });

        user.ownedGifts[giftIndex].isSent = true;
        user.ownedGifts[giftIndex].sentTo = recipientId;
        user.ownedGifts[giftIndex].sentAt = new Date();

        if (!recipient.receivedGifts) recipient.receivedGifts = [];
        recipient.receivedGifts.push({
            giftId: user.ownedGifts[giftIndex].giftId,
            from: req.userId,
            receivedAt: new Date()
        });

        await user.save();
        await recipient.save();

        const Message = require('../models/Message');
        const Conversation = require('../models/Conversation');
        const conv = await Conversation.findOne({ type: 'private', participants: { $all: [req.userId, recipientId] } });
        if (conv) {
            const gift = await Gift.findById(user.ownedGifts[giftIndex].giftId);
            const msg = new Message({
                conversationId: conv._id,
                sender: req.userId,
                text: `Отправил подарок: ${gift.name}`,
                messageType: 'gift',
                fileUrl: gift.imageUrl
            });
            await msg.save();
        }

        res.json({ message: 'Подарок отправлен' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/buy-jabbers', authMiddleware, async (req, res) => {
    try {
        const { amount, paymentProvider } = req.body;
        const user = await User.findById(req.userId);
        user.jabbersBalance += amount;
        await user.save();
        res.json({ message: `${amount} Jabbers начислено`, jabbersBalance: user.jabbersBalance });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/subscribe-vip', authMiddleware, async (req, res) => {
    try {
        const { durationMonths, paymentProvider } = req.body;
        const user = await User.findById(req.userId);
        const now = new Date();
        const endDate = new Date(now.getTime() + durationMonths * 30 * 24 * 60 * 60 * 1000);

        user.isVip = true;
        user.vipExpiresAt = endDate;
        user.vipLevel = user.vipLevel || 0;
        user.jabbersBalance += durationMonths * 500;
        await user.save();

        res.json({ message: 'JabberVip активирован', vipExpiresAt: endDate, jabbersBonus: durationMonths * 500 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/cancel-vip', authMiddleware, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.userId, { isVip: false, vipExpiresAt: null });
        res.json({ message: 'Подписка отменена' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
