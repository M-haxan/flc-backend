const express = require('express');
const router = express.Router();
const Lesson = require('../models/Lesson');
const { protect } = require('../middleware/authMiddleware');
const Exercise = require('../models/Exercise');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
// ☁️ CLOUDINARY & MULTER SETUP (NAYA)
// ==========================================
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
// Apni .env file se keys utha kar Cloudinary ko do
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer ko batao ke video Cloudinary par 'flc_videos' folder mein rakhni hai
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'flc_videos', 
    resource_type: 'video', // ⚠️ ZAROORI: Iske baghair Cloudinary isko tasveer (image) samajh lega
    allowed_formats: ['mp4', 'mkv', 'mov', 'avi'] // Sirf videos allow karein
  },
});

const upload = multer({ storage: storage });
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
// 1. DELETE EXERCISE (Exercise Delete Karna)
// ==========================================
router.delete('/exercises/:id', protect, async (req, res) => {
    try {
        // VIP Check: Sirf Admin delete kar sakta hai
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: "Access Denied!" });
        }

        // Database se exercise dhoondo aur delete kar do
        const exerciseId = req.params.id;
        await Exercise.findByIdAndDelete(exerciseId);

        res.status(200).json({ message: "Exercise Deleted Successfully!" });
    } catch (error) {
        console.error("Delete Error:", error);
        res.status(500).json({ message: "Error deleting exercise." });
    }
});
// 2. UPDATE EXERCISE (Naam ya Price tabdeel karna)
// ==========================================
router.put('/exercises/:id', protect, async (req, res) => {
    try {
        // VIP Check: Sirf Admin update kar sakta hai
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: "Access Denied!" });
        }

        const exerciseId = req.params.id;
        const { name, price } = req.body; // Frontend se naya naam aur price aayega

        // Database mein exercise dhoondo aur naya data set kar do
        const updatedExercise = await Exercise.findByIdAndUpdate(
            exerciseId, 
            { name: name, price: price }, 
            { new: true } // Yeh MongoDB ko kehta hai ke update hone ke baad naya data wapas bhejo
        );

        res.status(200).json({ message: "Exercise updated successfully!", exercise: updatedExercise });
    } catch (error) {
        console.error("Update Error:", error);
        res.status(500).json({ message: "Error updating exercise." });
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
            const allBookings = await Booking.find({ lesson: lesson._id });
            const bookingCount = allBookings.length;
            const completedCount = allBookings.filter(b => b.isCompleted).length;
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

            // 3. Calculate Completion Percentage
            let completionPercentage = 0;
            if (bookingCount > 0) {
                completionPercentage = ((completedCount / bookingCount) * 100).toFixed(1);
            }

            return {
                lessonId: lesson._id,
                exerciseName: lesson.exercise.name,
                day: lesson.day,
                timeSlot: lesson.timeSlot,
                date: lesson.date,
                bookedSeats: bookingCount,
                completedSeats: completedCount,
                totalSeats: 4,
                completionPercentage: completionPercentage,
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

// Route:   GET /api/lessons/:lessonId/reviews
// Desc:    Get all reviews for a specific lesson (Admin Only)
// Access:  Private (Admin)
router.get('/:lessonId/reviews', protect, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: "Access Denied!" });
        }

        const lessonId = req.params.lessonId;

        // Sabhi reviews fetch karo jis lesson ke liye hain aur user ka naam bhi lao
        const reviews = await Review.find({ lesson: lessonId })
            .populate({
                path: 'user',
                select: 'name email' // Sirf naam aur email chahiye
            })
            .sort({ createdAt: -1 }); // Sabse nayi review pehle

        // Lesson ka data bhi le aao taake admin ko context pata chal jaye
        const lesson = await Lesson.findById(lessonId).populate('exercise');

        res.status(200).json({
            lesson: {
                exerciseName: lesson.exercise.name,
                day: lesson.day,
                timeSlot: lesson.timeSlot,
                date: lesson.date
            },
            reviews: reviews,
            totalReviews: reviews.length
        });

    } catch (error) {
        console.error("Error fetching reviews: ", error);
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
// Route:   POST /api/lessons
// NAYA: 'upload.single('video')' humne raste mein guard ke tor par bitha diya hai
router.post('/', protect, upload.single('video'), async (req, res) => {
    try {
        // VIP SECURITY
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: "Access Denied! Sirf Admin nayi classes bana sakta hai." });
        }

        const { exerciseId, day, timeSlot, date } = req.body;

        if (!exerciseId || !day || !timeSlot || !date) {
            return res.status(400).json({ message: "Please provide all details (exercise, day, time, date)" });
        }

        // 🎥 NAYA: Cloudinary se aane wala Video URL pakrein
        let cloudVideoUrl = '';
        if (req.file) {
            // Cloudinary upload hone ke baad khud humein ek secure link deta hai jo req.file.path mein hota hai
            cloudVideoUrl = req.file.path; 
        }

        // Naya Lesson (Class) banayein
        const newLesson = new Lesson({
            exercise: exerciseId,
            day: day,
            timeSlot: timeSlot,
            date: date,
            videoUrl: cloudVideoUrl // Cloudinary ka link database mein save kar lo!
        });

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