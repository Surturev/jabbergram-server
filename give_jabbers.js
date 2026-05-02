const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/messenger').then(async () => {
    const User = require('./models/User');
    const result = await User.updateOne(
        { username: 'test_user' }, 
        { $inc: { jabbersBalance: 50000 } }
    );
    const user = await User.findOne({ username: 'test_user' });
    console.log('Success! New balance:', user.jabbersBalance);
    process.exit();
}).catch(e => console.error(e));
