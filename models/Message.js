const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, default: '' },
    messageType: { type: String, enum: ['text', 'image', 'video', 'audio', 'file', 'sticker', 'voice'], default: 'text' },
    fileUrl: { type: String, default: '' },
    fileName: { type: String, default: '' },
    fileSize: { type: Number, default: 0 },
    stickerUrl: { type: String, default: '' },
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
    isEdited: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    autoDeleteAt: { type: Date, default: null },
    scheduledSendAt: { type: Date, default: null },
    silent: { type: Boolean, default: false },
    forwardedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    forwardedMessageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
    reactions: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        emoji: String,
        createdAt: { type: Date, default: Date.now }
    }],
    voiceDuration: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ autoDeleteAt: 1 }, { sparse: true });

module.exports = mongoose.model('Message', MessageSchema);
