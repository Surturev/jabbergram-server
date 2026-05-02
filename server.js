require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const Message = require('./models/Message');
const Conversation = require('./models/Conversation');
const User = require('./models/User');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/email-auth', require('./routes/email-auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/conversations', require('./routes/conversations'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/files', require('./routes/files'));
app.use('/api/gifts', require('./routes/gifts'));
app.use('/api/aibot', require('./routes/aibot'));
app.use('/api/admin', require('./routes/admin'));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB подключена'))
    .catch(err => console.error('Ошибка MongoDB:', err));

const onlineUsers = new Map();
const offlineNotifications = new Map();

async function autoDeleteExpiredMessages() {
    const now = new Date();
    const expired = await Message.find({ autoDeleteAt: { $lte: now } });
    for (const msg of expired) {
        msg.isDeleted = true;
        await msg.save();
        io.to(msg.conversationId.toString()).emit('message_deleted', { messageId: msg._id.toString() });
    }
}
setInterval(autoDeleteExpiredMessages, 60000);

io.on('connection', (socket) => {
    console.log('Connected:', socket.id);

    socket.on('register_user', async (userId) => {
        onlineUsers.set(userId, socket.id);
        socket.userId = userId;
        await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
        await Conversation.updateMany(
            { participants: userId },
            { $pull: { typing: userId } }
        );

        const onlineList = Array.from(onlineUsers.keys());
        io.emit('users_online', onlineList);

        socket.join(userId);
        console.log(`User ${userId} online`);

        const pending = offlineNotifications.get(userId);
        if (pending) {
            pending.forEach(n => socket.emit('notification', n));
            offlineNotifications.delete(userId);
        }
    });

    socket.on('get_online_status', async (userId) => {
        const isOnline = onlineUsers.has(userId);
        let lastSeen = null;
        if (!isOnline) {
            const user = await User.findById(userId).select('lastSeen');
            lastSeen = user?.lastSeen;
        }
        socket.emit('online_status', { userId, isOnline, lastSeen });
    });

    socket.on('get_all_online_status', async (userIds) => {
        const statuses = {};
        for (const uid of userIds) {
            statuses[uid] = { isOnline: onlineUsers.has(uid) };
        }
        socket.emit('all_online_status', statuses);
    });

    socket.on('join_conversation', (conversationId) => {
        socket.join(conversationId);
    });

    socket.on('leave_conversation', (conversationId) => {
        socket.leave(conversationId);
    });

    socket.on('send_message', async (data) => {
        try {
            const { conversationId, text, messageType, fileUrl, fileName, fileSize, stickerUrl, replyTo, silent, autoDeleteSeconds, voiceDuration } = data;

            const autoDeleteAt = autoDeleteSeconds ? new Date(Date.now() + autoDeleteSeconds * 1000) : null;

            const message = new Message({
                conversationId,
                sender: data.senderId,
                text: text || '',
                messageType: messageType || 'text',
                fileUrl: fileUrl || '',
                fileName: fileName || '',
                fileSize: fileSize || 0,
                stickerUrl: stickerUrl || '',
                replyTo: replyTo || null,
                voiceDuration: voiceDuration || 0,
                autoDeleteAt,
                silent: silent || false,
                scheduledSendAt: data.scheduledSendAt || null
            });

            await message.save();
            const populated = await message.populate('sender', 'username displayName avatarUrl');

            const lastMsgText = messageType === 'voice' ? '[Голосовое]' : (text || '[Медиа]');
            await Conversation.findByIdAndUpdate(conversationId, {
                lastMessage: lastMsgText,
                lastMessageAt: new Date()
            });

            const msgData = {
                _id: populated._id,
                conversationId,
                sender: populated.sender,
                text: populated.text,
                messageType: populated.messageType,
                fileUrl: populated.fileUrl,
                fileName: populated.fileName,
                fileSize: populated.fileSize,
                stickerUrl: populated.stickerUrl,
                replyTo: populated.replyTo,
                voiceDuration: populated.voiceDuration,
                createdAt: populated.createdAt,
                autoDeleteAt: populated.autoDeleteAt,
                silent: populated.silent,
                isEdited: false,
                reactions: []
            };

            io.to(conversationId).emit('new_message', msgData);

            const conv = await Conversation.findById(conversationId);
            if (conv) {
                conv.participants.forEach(pId => {
                    if (pId.toString() !== data.senderId && !onlineUsers.has(pId.toString()) && !silent) {
                        const notification = {
                            type: 'new_message',
                            conversationId,
                            chatName: conv.name || 'Чат',
                            senderName: populated.sender.displayName,
                            text: lastMsgText,
                            messageId: populated._id
                        };
                        if (!offlineNotifications.has(pId.toString())) {
                            offlineNotifications.set(pId.toString(), []);
                        }
                        offlineNotifications.get(pId.toString()).push(notification);
                    }
                });
            }
        } catch (err) {
            socket.emit('error', { message: err.message });
        }
    });

    socket.on('edit_message', async (data) => {
        try {
            const msg = await Message.findById(data.messageId);
            if (!msg || msg.sender.toString() !== data.senderId) return;
            msg.text = data.text;
            msg.isEdited = true;
            await msg.save();
            io.to(data.conversationId).emit('message_edited', { messageId: data.messageId, text: data.text, isEdited: true });
        } catch (err) {
            socket.emit('error', { message: err.message });
        }
    });

    socket.on('delete_message', async (data) => {
        try {
            const msg = await Message.findById(data.messageId);
            if (!msg || msg.sender.toString() !== data.senderId) return;
            msg.isDeleted = true;
            await msg.save();
            io.to(data.conversationId).emit('message_deleted', { messageId: data.messageId, deleteForAll: data.deleteForAll });
        } catch (err) {
            socket.emit('error', { message: err.message });
        }
    });

    socket.on('add_reaction', async (data) => {
        try {
            const msg = await Message.findById(data.messageId);
            if (!msg) return;

            const existingIdx = msg.reactions.findIndex(r => r.userId.toString() === data.userId);
            if (existingIdx >= 0) {
                if (msg.reactions[existingIdx].emoji === data.emoji) {
                    msg.reactions.splice(existingIdx, 1);
                } else {
                    msg.reactions[existingIdx].emoji = data.emoji;
                }
            } else {
                msg.reactions.push({ userId: data.userId, emoji: data.emoji });
            }
            await msg.save();
            await msg.populate('reactions.userId', 'username displayName avatarUrl');
            io.to(data.conversationId).emit('reaction_updated', {
                messageId: data.messageId,
                reactions: msg.reactions
            });
        } catch (err) {
            socket.emit('error', { message: err.message });
        }
    });

    socket.on('forward_message', async (data) => {
        try {
            const original = await Message.findById(data.originalMessageId).populate('sender', 'username displayName avatarUrl');
            if (!original) return;

            const forward = new Message({
                conversationId: data.targetConversationId,
                sender: data.senderId,
                text: original.text,
                messageType: original.messageType,
                fileUrl: original.fileUrl,
                fileName: original.fileName,
                fileSize: original.fileSize,
                stickerUrl: original.stickerUrl,
                voiceDuration: original.voiceDuration,
                forwardedFrom: original.sender._id,
                forwardedMessageId: original._id
            });

            await forward.save();
            await Conversation.findByIdAndUpdate(data.targetConversationId, {
                lastMessage: forward.text || '[Пересланное]',
                lastMessageAt: new Date()
            });

            const populated = await forward.populate('sender', 'username displayName avatarUrl');
            io.to(data.targetConversationId).emit('new_message', {
                _id: populated._id,
                conversationId: data.targetConversationId,
                sender: populated.sender,
                text: populated.text,
                messageType: populated.messageType,
                fileUrl: populated.fileUrl,
                fileName: populated.fileName,
                fileSize: populated.fileSize,
                stickerUrl: populated.stickerUrl,
                voiceDuration: populated.voiceDuration,
                forwardedFrom: { _id: original.sender._id, displayName: original.sender.displayName },
                createdAt: populated.createdAt,
                isEdited: false,
                reactions: []
            });
        } catch (err) {
            socket.emit('error', { message: err.message });
        }
    });

    socket.on('typing_start', (data) => {
        io.to(data.conversationId).emit('user_typing', { userId: data.userId, conversationId: data.conversationId, isTyping: true });
    });

    socket.on('typing_stop', (data) => {
        io.to(data.conversationId).emit('user_typing', { userId: data.userId, conversationId: data.conversationId, isTyping: false });
    });

    socket.on('read_messages', async (data) => {
        try {
            await Message.updateMany(
                { conversationId: data.conversationId, sender: { $ne: data.userId } },
                { $addToSet: { readBy: data.userId } }
            );
            io.to(data.conversationId).emit('messages_read', { userId: data.userId, conversationId: data.conversationId });
        } catch (err) {
            socket.emit('error', { message: err.message });
        }
    });

    socket.on('mark_delivered', async (data) => {
        try {
            await Message.findByIdAndUpdate(data.messageId, {
                $addToSet: { deliveredTo: data.userId }
            });
            io.to(data.conversationId).emit('message_delivered', { messageId: data.messageId, userId: data.userId });
        } catch (err) {
            socket.emit('error', { message: err.message });
        }
    });

    socket.on('disconnect', () => {
        const userId = socket.userId;
        if (userId) {
            onlineUsers.delete(userId);
            io.emit('users_online', Array.from(onlineUsers.keys()));
            console.log(`User ${userId} offline`);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`Доступен по: http://localhost:${PORT}`);
});

const LATEST_VERSION = {
    versionCode: 3,
    versionName: "3.0",
    changelog: "• Админ-панель\n• Поиск по username\n• Новые профили и настройки\n• Счётчик непрочитанных\n• Улучшенный UI чатов\n• Исправление ошибок",
    downloadUrl: "/api/app/download"
};

app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/api/app/version', (req, res) => {
    res.json(LATEST_VERSION);
});

app.get('/api/app/download', (req, res) => {
    const apkPath = path.join(__dirname, 'Jabbergram.apk');
    if (!require('fs').existsSync(apkPath)) {
        return res.status(404).json({ error: 'APK не найден на сервере' });
    }
    res.download(apkPath, 'Jabbergram.apk');
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...');
    server.close(() => {
        mongoose.connection.close();
        process.exit(0);
    });
});
