const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Lesson = require('../models/Lesson');
const exercise = require('../models/Exercise');
const { protect } = require('../middleware/authMiddleware'); // Hamara Security Guard!

// Route:   POST /api/bookings
// Desc:    Book a lesson for a member
// Access:  Private (Sirf logged-in users ke liye)
router.post('/', protect, async (req, res) => {
    try {
        // 1. Frontend sirf ye batayega ke kaunsa lesson book karna hai
        const { lessonId } = req.body; 
        
        // userId humein frontend se nahi, balke apne 'protect' middleware se milegi! (Security)
        const userId = req.user.userId; 

        // 2. Pehle Lesson ko database se dhoondein taake uska Day aur Time pata chal sake
        const lessonToBook = await Lesson.findById(lessonId);
        if (!lessonToBook) {
            return res.status(404).json({ message: "Lesson not found" });
        }

        // ---------------------------------------------------------
        // CHALLENGE 1: CAPACITY CHECK (Max 4 members)
        // ---------------------------------------------------------
        // Database se puchen: "Is lessonId ki kitni bookings already exist karti hain?"
        const existingBookingsCount = await Booking.countDocuments({ lesson: lessonId });
        
        if (existingBookingsCount >= 4) {
            return res.status(400).json({ message: "Sorry, this class is already full (Max 4 members)." });
        }

        // ---------------------------------------------------------
        // CHALLENGE 2: TIME CONFLICT CHECK
        // ---------------------------------------------------------
        // Hamein check karna hai ke is User ki pehle se koi aesi booking toh nahi 
        // jiska Day aur TimeSlot is naye lesson se match karta ho.
        
        // (Iska query logic thora advanced hai, main abhi simple rakh raha hoon)
        // Pehle is user ki saari bookings nikalte hain aur unke lessons ki detail (populate) sath late hain:
        const userBookings = await Booking.find({ user: userId }).populate('lesson');
        
        const hasConflict = userBookings.some(booking => {
            return booking.lesson.day === lessonToBook.day && 
                   booking.lesson.timeSlot === lessonToBook.timeSlot &&
                   booking.lesson.date.getTime() === lessonToBook.date.getTime(); // Same weekend check
        });

        if (hasConflict) {
            return res.status(400).json({ message: "Time conflict! You already have a class scheduled at this time." });
        }

        // ---------------------------------------------------------
        // FINAL STEP: SAVE THE BOOKING
        // ---------------------------------------------------------
        // Agar dono checks pass ho gaye, toh finally booking create kar dein!
        const newBooking = new Booking({
            user: userId,
            lesson: lessonId
        });

        await newBooking.save();

        res.status(201).json({ 
            message: "Lesson booked successfully!", 
            booking: newBooking 
        });

    } catch (error) {
        console.error("Booking Error: ", error);
        res.status(500).json({ message: "Server Error while booking" });
    }
});
// Route:   GET /api/bookings/my-bookings
// Desc:    Get logged in user's bookings
// Access:  Private (Sirf apni bookings dekh sakte hain)
router.get('/my-bookings', protect, async (req, res) => {
    try {
        // Hamara Guard (middleware) humein req.user.userId de raha hai
        const userId = req.user.userId;

        // Yahan hum Advanced "Deep Populate" use kar rahe hain
        const myBookings = await Booking.find({ user: userId })
            .populate({
                path: 'lesson',           // Pehle Lesson ka data lao
                populate: {               // Phir us Lesson ke ANDAR jao...
                    path: 'exercise',     // ...aur uski Exercise ka data bhi lao!
                    model: 'Exercise'
                }
            });

        res.status(200).json({
            count: myBookings.length,
            bookings: myBookings
        });

    } catch (error) {
        console.error("Error fetching user bookings: ", error);
        res.status(500).json({ message: "Server Error while fetching your bookings" });
    }
});
module.exports = router;