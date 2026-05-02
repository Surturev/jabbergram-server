const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/messenger').then(async () => {
    const User = require('./models/User');
    const result = await User.updateOne({ username: 'test_user' }, { $set: { isAdmin: true } });
    console.log('Updated user:', JSON.stringify(result, null, 2));
    
    // Verify
    const user = await User.findOne({ username: 'test_user' });
    console.log('Is Admin:', user.isAdmin);
    process.exit();
}).catch(e => console.error(e));
