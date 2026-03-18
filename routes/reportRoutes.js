const express = require('express');
const router = express.Router();
const Lesson = require('../models/Lesson');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const { protect } = require('../middleware/authMiddleware');

// Middleware: Sirf Admin ko allow karne ke liye
const adminOnly = (req, res, next) => {
    // req.user.role humein token se mil raha hai
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Access Denied. Only Admins can view reports." });
    }
    next();
};

// Route:   GET /api/reports/attendance
// Desc:    Get number of members and average rating for each lesson
// Access:  Private (Admin Only)
router.get('/attendance', protect, adminOnly, async (req, res) => {
    try {
        // 1. Pura timetable (Lessons) nikal lo, sath exercise ka naam bhi
        const lessons = await Lesson.find().populate('exercise');

        // 2. Har lesson pe loop lagao aur uska data calculate karo
        // (Kyunki loop ke andar database queries hain, isliye Promise.all use karte hain)
        const reportData = await Promise.all(lessons.map(async (lesson) => {
            
            // A. Is lesson ki kitni bookings hain? (Count)
            const memberCount = await Booking.countDocuments({ lesson: lesson._id });

            // B. Is lesson ke reviews nikal lo
            const reviews = await Review.find({ lesson: lesson._id });
            
            // C. Average Rating Calculate karo (Maths!)
            let avgRating = 0;
            if (reviews.length > 0) {
                // .reduce() saari ratings ko plus kar dega, phir total reviews se divide kar denge
                const totalStars = reviews.reduce((sum, review) => sum + review.rating, 0);
                avgRating = (totalStars / reviews.length).toFixed(1); // .toFixed(1) se '4.5' jaisa format banega
            }

            // D. Ek khoobsurat object bana kar wapis bhej do
            return {
                lessonId: lesson._id,
                exerciseName: lesson.exercise.name,
                schedule: `${lesson.day} - ${lesson.timeSlot}`,
                totalMembersRegistered: memberCount,
                averageRating: parseFloat(avgRating)
            };
        }));

        res.status(200).json({
            message: "Attendance and Rating Report",
            report: reportData
        });

    } catch (error) {
        console.error("Report Error: ", error);
        res.status(500).json({ message: "Server Error while generating report" });
    }
});

module.exports = router;