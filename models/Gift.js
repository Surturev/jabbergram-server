const mongoose = require('mongoose');

const GiftSchema = new mongoose.Schema({
    giftId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    rarity: { type: String, enum: ['common', 'rare', 'epic', 'legendary'], default: 'common' },
    priceJabbers: { type: Number, required: true },
    imageUrl: { type: String, default: '' },
    animationUrl: { type: String, default: '' },
    totalSupply: { type: Number, default: 0 },
    remainingSupply: { type: Number, default: 0 },
    nftContract: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Gift', GiftSchema);
