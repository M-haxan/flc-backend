const mongoose = require('mongoose');
require('dotenv').config();
const Exercise = require('./models/Exercise');
const Lesson = require('./models/Lesson');

// Database se connect karein
mongoose.connect('mongodb://127.0.0.1:27017/furzefield_db')
    .then(async () => {
        console.log('Connected to DB for Seeding...');
        
        // 1. Pehle purana kachra saaf karein
        await Exercise.deleteMany();
        await Lesson.deleteMany();

        // 2. Ek Exercise banayein
        const yoga = new Exercise({ name: 'Yoga', price: 10 });
        await yoga.save();

        // 3. Us exercise ka ek Lesson (timetable slot) banayein
        const newLesson = new Lesson({
            exercise: yoga._id,
            day: 'Saturday',
            timeSlot: 'Morning',
            date: new Date('2026-03-21') // Aane wale weekend ki date
        });
        await newLesson.save();

        console.log('✅ Dummy Data Inserted Successfully!');
        console.log('👇 YEH ID COPY KAR LEIN BOOKING TEST KE LIYE 👇');
        console.log(`"lessonId": "${newLesson._id}"`);
        
        process.exit();
    })
    .catch(err => console.log(err));