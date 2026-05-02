const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema({
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    fileUrl: { type: String, required: true },
    thumbnailUrl: { type: String, default: '' },
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', default: null },
    isAvatar: { type: Boolean, default: false },
    uploadedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('File', FileSchema);
