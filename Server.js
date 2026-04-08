// 1. Packages Import Karein
const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const cors = require('cors');
// 2. Apne banaye hue routes import karein
const userRoutes = require('./routes/userRoutes'); 
const mongouri = process.env.MONGO_URI;

// 3. Express app initialize karein
const app = express();
app.use(cors());
// 4. Middleware: Yeh line backend ko JSON data (jo frontend se aayega) samajhne ke qabil banati hai
app.use(express.json());

// 5. MongoDB Database se connect karein
// (Agar aapke paas local MongoDB hai toh yeh link chalega, warna MongoDB Atlas ka link aayega)
console.log("🔗 MERA DATABASE LINK YEH HAI:", process.env.MONGO_URI);
mongoose.connect(mongouri)
    .then(() => console.log('✅ MongoDB Connected Successfully!'))
    .catch((err) => console.error('❌ MongoDB Connection Error:', err));

// 6. Routes ko App ke sath link karein
// Jab bhi koi /api/users pe jayega, express usko userRoutes file mein bhej dega
app.use('/api/users', userRoutes);
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/lessons', require('./routes/lessonRoutes'));
app.use('/api/reviews', require('./routes/reviewRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
// 7. Server ko kisi Port par run karein
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
module.exports = app;