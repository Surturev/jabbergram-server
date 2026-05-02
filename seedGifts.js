const mongoose = require('mongoose');
require('dotenv').config();
const Gift = require('./models/Gift');

const gifts = [
    {
        giftId: 'plush_pepe',
        name: 'Plush Pepe',
        description: 'NFT-подарок с анимацией мягкой игрушки, связанной с интернет-мемом о лягушонке Пепе.',
        rarity: 'rare',
        priceJabbers: 150,
        imageUrl: '/uploads/gifts/plush_pepe.png',
        remainingSupply: 1000
    },
    {
        giftId: 'heart_locket',
        name: 'Heart Locket',
        description: 'Утончённый NFT-подарок с анимацией раскрывающегося медальона.',
        rarity: 'epic',
        priceJabbers: 300,
        imageUrl: '/uploads/gifts/heart_locket.png',
        remainingSupply: 500
    },
    {
        giftId: 'jabber_cap',
        name: 'Jabber Cap',
        description: 'NFT-подарок, вдохновлённый образом основателя Jabbergram.',
        rarity: 'legendary',
        priceJabbers: 500,
        imageUrl: '/uploads/gifts/jabber_cap.png',
        remainingSupply: 200
    },
    {
        giftId: 'precious_peach',
        name: 'Precious Peach',
        description: 'NFT-подарок с шутливым подтекстом, связанный с интернет-культурой.',
        rarity: 'rare',
        priceJabbers: 100,
        imageUrl: '/uploads/gifts/precious_peach.png',
        remainingSupply: 1500
    },
    {
        giftId: 'heroic_helmet',
        name: 'Heroic Helmet',
        description: 'Подарок с атмосферой легендарных артефактов из фэнтезийных игр или древних мифов.',
        rarity: 'legendary',
        priceJabbers: 750,
        imageUrl: '/uploads/gifts/heroic_helmet.png',
        remainingSupply: 100
    },
    {
        giftId: 'nail_bracelet',
        name: 'Nail Bracelet',
        description: 'Элегантный аксессуар в минималистичном дизайне, напоминающий ювелирное украшение.',
        rarity: 'common',
        priceJabbers: 50,
        imageUrl: '/uploads/gifts/nail_bracelet.png',
        remainingSupply: 3000
    },
    {
        giftId: 'loot_bag',
        name: 'Loot Bag',
        description: 'Стильная дамская сумочка.',
        rarity: 'common',
        priceJabbers: 75,
        imageUrl: '/uploads/gifts/loot_bag.png',
        remainingSupply: 2500
    },
    {
        giftId: 'astral_shard',
        name: 'Astral Shard',
        description: 'Кристалл с эффектом свечения.',
        rarity: 'epic',
        priceJabbers: 400,
        imageUrl: '/uploads/gifts/astral_shard.png',
        remainingSupply: 300
    },
    {
        giftId: 'perfume_bottle',
        name: 'Perfume Bottle',
        description: 'Детализированный и элегантный NFT-подарок.',
        rarity: 'rare',
        priceJabbers: 200,
        imageUrl: '/uploads/gifts/perfume_bottle.png',
        remainingSupply: 800
    }
];

async function seed() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB подключена');

        await Gift.deleteMany({});
        await Gift.insertMany(gifts);
        console.log('Каталог подарков создан!');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

seed();
