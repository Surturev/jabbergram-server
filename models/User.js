const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    phone: { type: String, unique: true, sparse: true },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    displayName: { type: String },
    bio: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
    isOnline: { type: Boolean, default: false },
    twoFactorSecret: { type: String, default: '' },
    twoFactorEnabled: { type: Boolean, default: false },
    premium: { type: Boolean, default: false },
    premiumExpiresAt: { type: Date, default: null },
    accentColor: { type: String, default: '#667eea' },
    profiles: [{
        name: String,
        avatarUrl: String,
        bio: String,
        isActive: { type: Boolean, default: false }
    }],
    settings: {
        autoDeleteMessages: { type: Number, default: 0 },
        notificationSound: { type: Boolean, default: true },
        darkTheme: { type: Boolean, default: true },
        screenshotBlock: { type: Boolean, default: false }
    },
    contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    chatFolders: [{
        name: String,
        chatIds: [String],
        icon: String
    }],
    createdAt: { type: Date, default: Date.now },
    lastSeen: { type: Date, default: Date.now },
    jabbersBalance: { type: Number, default: 0 },
    isVip: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false },
    isBot: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false },
    banReason: { type: String, default: '' },
    bannedAt: { type: Date, default: null },
    vipExpiresAt: { type: Date, default: null },
    vipLevel: { type: Number, default: 0 },
    ownedGifts: [{
        giftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gift' },
        purchasedAt: Date,
        isSent: { type: Boolean, default: false },
        sentTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        sentAt: Date
    }],
    receivedGifts: [{
        giftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gift' },
        from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        receivedAt: Date
    }]
});

module.exports = mongoose.model('User', UserSchema);
