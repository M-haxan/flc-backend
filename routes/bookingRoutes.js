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
router.delete('/:id', protect, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) return res.status(404).json({ message: "Booking nahi mili" });

        // Security: Sirf wahi user delete kare jiski booking hai
        if (booking.user.toString() !== req.user.userId) {
            return res.status(403).json({ message: "Aap kisi aur ki booking delete nahi kar sakte!" });
        }

        await Booking.findByIdAndDelete(req.params.id);
        res.json({ message: "Booking successfully cancel ho gayi!" });
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
});

// 2. SWAP/CHANGE BOOKING (Nayi Requirement ✅)
// Route: PUT /api/bookings/:id
router.put('/:id', protect, async (req, res) => {
    try {
        const { newLessonId } = req.body;
        const bookingId = req.params.id;

        // 1. Naya lesson dhoondo aur check karo jagah hai?
        const newLesson = await Lesson.findById(newLessonId);
        const count = await Booking.countDocuments({ lesson: newLessonId });
        if (count >= 4) return res.status(400).json({ message: "Nayi class full hai!" });

        // 2. Conflict check (Purani booking ko chor kar)
        const userBookings = await Booking.find({ user: req.user.userId, _id: { $ne: bookingId } }).populate('lesson');
        const hasConflict = userBookings.some(b => 
            b.lesson.day === newLesson.day && b.lesson.timeSlot === newLesson.timeSlot
        );
        if (hasConflict) return res.status(400).json({ message: "Time conflict! Nayi class ke waqt aapki pehle hi ek class hai." });

        // 3. Update kar do
        const updatedBooking = await Booking.findByIdAndUpdate(bookingId, { lesson: newLessonId }, { new: true });
        res.json({ message: "Booking successfully change ho gayi!", updatedBooking });
    } catch (error) {
        res.status(500).json({ message: "Change karne mein masla aya" });
    }
});

// 3. MARK LESSON AS COMPLETE (NAYA ENDPOINT)
// Route: POST /api/bookings/:bookingId/complete
// Desc: Mark a lesson as completed (with time validation)
// Access: Private
router.post('/:bookingId/complete', protect, async (req, res) => {
    try {
        const bookingId = req.params.bookingId;
        const userId = req.user.userId;

        // 1. Booking dhoundo
        const booking = await Booking.findById(bookingId).populate('lesson');
        
        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }

        // 2. Security: Sirf sahi user hi apni booking complete kar sakta hai
        if (booking.user.toString() !== userId) {
            return res.status(403).json({ message: "You can only mark your own bookings as complete!" });
        }

        // 3. TIME VALIDATION: Check karein ke kya user apne lesson ke time slot ke doran hi mark kar raha hai
        const now = new Date();
        const lessonDate = new Date(booking.lesson.date);
        const currentHour = now.getHours();
        const timeSlot = booking.lesson.timeSlot;

        // Check same day
        const isSameDay = now.getFullYear() === lessonDate.getFullYear() &&
                         now.getMonth() === lessonDate.getMonth() &&
                         now.getDate() === lessonDate.getDate();

        const isValidTime = 
            (timeSlot === 'Morning' && currentHour >= 9 && currentHour < 11) ||
            (timeSlot === 'Afternoon' && currentHour >= 13 && currentHour < 15) ||
            (timeSlot === 'Evening' && currentHour >= 17 && currentHour < 19);

        if (!isSameDay || !isValidTime) {
            return res.status(403).json({ 
                message: `You can only mark this lesson as complete during ${timeSlot} time slot!` 
            });
        }

        // 4. IDEMPOTENT: Agar pehle se complete hai toh just return karein
        if (booking.isCompleted) {
            return res.status(200).json({ 
                message: "Already completed! This is a rewatch.",
                isRewatch: true,
                booking: booking
            });
        }

        // 5. MARK AS COMPLETE (First time)
        booking.isCompleted = true;
        booking.completedAt = new Date();
        await booking.save();

        return res.status(200).json({ 
            message: "Lesson marked as complete! Congratulations! 🎉",
            isRewatch: false,
            booking: booking
        });

    } catch (error) {
        console.error("Error marking lesson complete: ", error);
        res.status(500).json({ message: "Server Error while marking lesson complete" });
    }
});

// Route: DELETE /api/lessons/:id

module.exports = router;