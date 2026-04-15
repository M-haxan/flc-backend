const express = require('express');
const router = express.Router();
const Lesson = require('../models/Lesson');
const { protect } = require('../middleware/authMiddleware');
const Exercise = require('../models/Exercise');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
// Route:   GET /api/lessons
// Desc:    Get all scheduled lessons for the frontend timetable
// Access:  Public (Bina login kiye bhi log timetable dekh sakein)
// Test route for Vercel

// Route: GET /api/exercises
router.get('/exercises', async (req, res) => {
    try {
        const exercises = await Exercise.find();
        res.json(exercises);
    } catch (error) {
        res.status(500).json({ message: "Error fetching exercises" });
    }
});
// Desc:    Add a new Base Exercise (Admin Only)
router.post('/exercises', protect, async (req, res) => {
    try {
        // VIP Check: Sirf admin aa sakta hai
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: "Access Denied!" });
        }

        const { name, price } = req.body;

        if (!name || !price) {
            return res.status(400).json({ message: "Name aur Price dono zaroori hain!" });
        }

        // Database mein nayi exercise create karein
        const newExercise = new Exercise({
            name: name,
            price: price
        });

        await newExercise.save();
        res.status(201).json({ message: "Exercise added successfully!", exercise: newExercise });

    } catch (error) {
        console.error("Error adding exercise:", error);
        res.status(500).json({ message: "Server error" });
    }
});
// Route:   GET /api/lessons/reports/attendance
// Desc:    Get detailed report (Attendance, Rating, Income)
router.get('/reports/attendance', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ message: "Access Denied!" });

        const lessons = await Lesson.find().populate('exercise');
        
        // NAYA: Har exercise ka total paisa jama karne ke liye ek khali object
        let incomeTracker = {}; 

        const reportData = await Promise.all(lessons.map(async (lesson) => {
            
            // 1. Bookings & Income calculate karein
            const bookingCount = await Booking.countDocuments({ lesson: lesson._id });
            const classIncome = bookingCount * lesson.exercise.price; // Paise = Log * Ticket Price
            
            // Income Tracker mein is exercise ke paise daal dein
            const exName = lesson.exercise.name;
            if (!incomeTracker[exName]) incomeTracker[exName] = 0;
            incomeTracker[exName] += classIncome;

            // 2. Reviews & Average Rating nikalen
            const reviews = await Review.find({ lesson: lesson._id });
            let avgRating = 0;
            if (reviews.length > 0) {
                // Saare stars ko plus karo
                const totalStars = reviews.reduce((sum, rev) => sum + rev.rating, 0);
                // Total stars ko reviews ki tadad se divide kar do
                avgRating = (totalStars / reviews.length).toFixed(1); 
            }

            return {
                lessonId: lesson._id,
                exerciseName: lesson.exercise.name,
                day: lesson.day,
                timeSlot: lesson.timeSlot,
                date: lesson.date,
                bookedSeats: bookingCount,
                totalSeats: 4,
                status: bookingCount >= 4 ? 'Full' : 'Available',
                avgRating: avgRating, // Nayi Field
                income: classIncome   // Nayi Field
            };
        }));

        // 3. Highest Income Generator dhoondein (Sabse zyada paise kisne kamaye?)
        let topEarner = { name: 'No Data', income: 0 };
        for (const [name, amount] of Object.entries(incomeTracker)) {
            if (amount > topEarner.income) {
                topEarner = { name: name, income: amount };
            }
        }

        // Frontend ko saara data ek package mein bhej dein
        res.status(200).json({
            classesReport: reportData,
            highestEarner: topEarner
        });

    } catch (error) {
        console.error("Error generating report: ", error);
        res.status(500).json({ message: "Server Error" });
    }
});
// Route:   GET /api/lessons
// Desc:    Get all scheduled lessons ALONG WITH THEIR BOOKING COUNTS
router.get('/', async (req, res) => {
    try {
        // Pehle saari classes le aao
        const lessons = await Lesson.find().populate('exercise');
        
        // 💡 NAYA LOGIC: Har class ke liye Booking collection se count dhoondo
        const lessonsWithCounts = await Promise.all(lessons.map(async (lesson) => {
            // Check karo ke is class (lesson._id) ki kitni bookings hain
            const bookedCount = await Booking.countDocuments({ lesson: lesson._id });
            
            // Class ka asal data aur uska 'bookedCount' mila kar wapas bhejo
            return {
                ...lesson.toObject(), // Mongoose doc ko normal JS object banaya
                bookedCount: bookedCount // Yeh wo cheez hai jis ka frontend intezaar kar raha tha!
            };
        }));
        
        res.status(200).json({
            count: lessonsWithCounts.length,
            lessons: lessonsWithCounts // Ab nayi array frontend ko bhejo
        });
    } catch (error) {
        console.error("Error fetching lessons: ", error);
        res.status(500).json({ message: "Server Error while fetching timetable" });
    }
});
router.post('/', protect, async (req, res) => {
    try {
        // 1. VIP SECURITY: Kya yeh user waqai Admin hai? 🛑
        // (Hamara protect middleware req.user set kar deta hai)
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: "Access Denied! Sirf Admin nayi classes bana sakta hai." });
        }

        // 2. Frontend se aane wala data
        const { exerciseId, day, timeSlot, date } = req.body;

        // Validation: Koi field khali toh nahi?
        if (!exerciseId || !day || !timeSlot || !date) {
            return res.status(400).json({ message: "Please provide all details (exercise, day, time, date)" });
        }

        // 3. Naya Lesson (Class) banayein
        const newLesson = new Lesson({
            exercise: exerciseId, // Yoga, Zumba waghaira ki ID
            day: day,
            timeSlot: timeSlot,
            date: date
        });

        // 4. Database mein save karein
        await newLesson.save();

        res.status(201).json({
            message: "Zabardast! Nayi class successfully schedule ho gayi.",
            lesson: newLesson
        });

    } catch (error) {
        console.error("Error creating lesson: ", error);
        res.status(500).json({ message: "Server Error while creating class" });
    }
});
router.delete('/:id', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: "Access Denied!" });
        }

        // Pehle is class ki saari bookings delete karo
        const Booking = require('../models/Booking'); // Make sure ye line top par ya yahan mojood ho
        await Booking.deleteMany({ lesson: req.params.id });
        
        // Phir main class ko delete karo
        await Lesson.findByIdAndDelete(req.params.id);

        res.status(200).json({ message: "Class aur uski bookings delete kar di gayi hain. 🗑️" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error while deleting class." });
    }
});
module.exports = router;