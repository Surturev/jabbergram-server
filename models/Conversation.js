const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
    type: { type: String, enum: ['private', 'group', 'bot'], default: 'private' },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    name: { type: String, default: '' },
    description: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    folder: { type: String, default: '' },
    lastMessage: { type: String, default: '' },
    lastMessageAt: { type: Date, default: Date.now },
    isMuted: { type: Boolean, default: false },
    isPinned: { type: Boolean, default: false },
    typing: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now }
});

ConversationSchema.index({ participants: 1 });

module.exports = mongoose.model('Conversation', ConversationSchema);
