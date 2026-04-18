const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Booking = require('../models/Booking'); // Booking check karne ke liye
const { protect } = require('../middleware/authMiddleware');

// Route:   POST /api/reviews
// Desc:    Add a review for a lesson
// Access:  Private (Sirf logged-in users ke liye)
router.post('/', protect, async (req, res) => {
    try {
        const { lessonId, rating, comment } = req.body;
        const userId = req.user.userId;

        // 1. Basic Validation: Rating 1 se 5 ke darmiyan honi chahiye
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ message: "Please provide a valid rating between 1 and 5." });
        }

        // 2. Pro Check 1: Kya user ne waqai ye class book ki thi?
        const hasBooked = await Booking.findOne({ user: userId, lesson: lessonId });
        if (!hasBooked) {
            return res.status(400).json({ message: "You can only review lessons that you have booked!" });
        }

        // 🆕 Pro Check 1.5: Kya user ne lesson complete kiya hai?
        if (!hasBooked.isCompleted) {
            return res.status(403).json({ message: "You can only review lessons that you have completed!" });
        }

        // 3. Pro Check 2: Kya user is lesson ka pehle review de chuka hai?
        const alreadyReviewed = await Review.findOne({ user: userId, lesson: lessonId });
        if (alreadyReviewed) {
            return res.status(400).json({ message: "You have already reviewed this lesson." });
        }

        // 4. Sab theek hai toh Review Save kar dein
        const newReview = new Review({
            user: userId,
            lesson: lessonId,
            rating: rating,
            comment: comment // Agar comment nahi bhi bheja toh koi masla nahi, optional hai
        });

        await newReview.save();

        res.status(201).json({ 
            message: "Thank you! Your review has been submitted.",
            review: newReview 
        });

    } catch (error) {
        console.error("Review Error: ", error);
        res.status(500).json({ message: "Server Error while submitting review" });
    }
});

module.exports = router;