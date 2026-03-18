const express = require('express');
const router = express.Router();
const Lesson = require('../models/Lesson');

// Route:   GET /api/lessons
// Desc:    Get all scheduled lessons for the frontend timetable
// Access:  Public (Bina login kiye bhi log timetable dekh sakein)
router.get('/', async (req, res) => {
    try {
        // .find() saare lessons le aayega.
        // .populate('exercise') lesson ke andar uski price aur name bhi le aayega.
        const lessons = await Lesson.find().populate('exercise');
        
        res.status(200).json({
            count: lessons.length,
            lessons: lessons
        });
    } catch (error) {
        console.error("Error fetching lessons: ", error);
        res.status(500).json({ message: "Server Error while fetching timetable" });
    }
});

module.exports = router;