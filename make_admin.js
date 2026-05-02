const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/messenger').then(async () => {
    const User = require('./models/User');
    
    // Update using the specific ID found in the previous step
    const userId = '69f58ebea817e2b0638696a0';
    
    const result = await User.updateOne(
        { _id: userId }, 
        { $set: { isAdmin: true } }
    );
    
    console.log('Result:', JSON.stringify(result, null, 2));
    
    const updatedUser = await User.findById(userId);
    console.log('User is now admin:', updatedUser.isAdmin);
    process.exit();
}).catch(e => console.error(e));
