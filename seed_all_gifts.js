require('dotenv').config();
const mongoose = require('mongoose');
const Gift = require('./models/Gift');

const gifts = [
    { giftId: 'plush_pepe', name: 'Plush Pepe', description: 'Мягкая игрушка Пепе.', rarity: 'rare', priceJabbers: 150, imageUrl: '', remainingSupply: 1000 },
    { giftId: 'heart_locket', name: 'Heart Locket', description: 'Раскрывающийся медальон.', rarity: 'epic', priceJabbers: 300, imageUrl: '', remainingSupply: 500 },
    { giftId: 'jabber_cap', name: 'Jabber Cap', description: 'Кепка основателя.', rarity: 'legendary', priceJabbers: 500, imageUrl: '', remainingSupply: 200 },
    { giftId: 'precious_peach', name: 'Precious Peach', description: 'Шутливый персик.', rarity: 'rare', priceJabbers: 100, imageUrl: '', remainingSupply: 1500 },
    { giftId: 'heroic_helmet', name: 'Heroic Helmet', description: 'Легендарный шлем.', rarity: 'legendary', priceJabbers: 750, imageUrl: '', remainingSupply: 100 },
    { giftId: 'nail_bracelet', name: 'Nail Bracelet', description: 'Минималистичный браслет.', rarity: 'common', priceJabbers: 50, imageUrl: '', remainingSupply: 3000 },
    { giftId: 'loot_bag', name: 'Loot Bag', description: 'Стильная сумочка.', rarity: 'common', priceJabbers: 75, imageUrl: '', remainingSupply: 2500 },
    { giftId: 'astral_shard', name: 'Astral Shard', description: 'Светящийся кристалл.', rarity: 'epic', priceJabbers: 400, imageUrl: '', remainingSupply: 300 },
    { giftId: 'perfume_bottle', name: 'Perfume Bottle', description: 'Элегантный флакон духов.', rarity: 'rare', priceJabbers: 200, imageUrl: '', remainingSupply: 800 }
];

mongoose.connect(process.env.MONGO_URI).then(async () => {
    await Gift.deleteMany({});
    await Gift.insertMany(gifts);
    console.log('All 9 gifts seeded successfully!');
    process.exit(0);
}).catch(e => console.error(e));
