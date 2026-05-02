const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect('mongodb://localhost:27017/messenger')
    .then(async () => {
        console.log('MongoDB connected');
        const db = mongoose.connection.db;
        
        // Drop the entire messenger database to clear everything
        await db.dropDatabase();
        console.log('Database cleared successfully!');
        process.exit(0);
    })
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
