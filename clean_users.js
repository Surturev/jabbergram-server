const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/messenger')
    .then(async () => {
        console.log('MongoDB connected');
        const User = require('./models/User');
        const users = await User.find({}, 'username displayName createdAt');
        console.log('\nНайдено пользователей:', users.length);
        users.forEach(u => {
            console.log(`  ${u._id} — @${u.username} (${u.displayName || '-'}) — ${u.createdAt}`);
        });

        const keepUsername = 'surturev';
        const keeper = users.find(u => u.username.toLowerCase() === keepUsername);

        if (!keeper) {
            console.log('\nЮзер @surturev не найден!');
            process.exit(1);
        }

        const usersToDelete = users.filter(u => u.username.toLowerCase() !== keepUsername);
        if (usersToDelete.length === 0) {
            console.log('\nНечего удалять.');
            process.exit(0);
        }

        console.log(`\nУдаляю ${usersToDelete.length} юзеров (кроме @${keepUsername})...`);
        await User.deleteMany({ _id: { $in: usersToDelete.map(u => u._id) } });

        console.log('Удаляю чаты без surturev...');
        await mongoose.model('Conversation').deleteMany({ participants: { $ne: keeper._id } });

        console.log('Удаляю сообщения без чатов...');
        const convIds = await mongoose.model('Conversation').find({}, '_id').then(cs => cs.map(c => c._id));
        await mongoose.model('Message').deleteMany({ conversationId: { $nin: convIds } });

        console.log('\nГотово!');
        process.exit(0);
    })
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
