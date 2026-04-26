const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Lesson = require('../models/Lesson');
const exercise = require('../models/Exercise');
const { protect } = require('../middleware/authMiddleware'); // Hamara Security Guard!

// ✅ Helper Functions
const getTimeSlotWindow = (lessonDate, timeSlot) => {
    const start = new Date(lessonDate);
    const end = new Date(lessonDate);
    
    if (timeSlot === 'Morning') {
        start.setHours(9, 0, 0, 0);
        end.setHours(11, 0, 0, 0);
    } else if (timeSlot === 'Afternoon') {
        start.setHours(13, 0, 0, 0);
        end.setHours(15, 0, 0, 0);
    } else if (timeSlot === 'Evening') {
        start.setHours(17, 0, 0, 0);
        end.setHours(19, 0, 0, 0);
    }
    
    return { start, end };
};

const canAccessVideo = (lessonDate, timeSlot) => {
    const now = new Date();
    const gracePeriod = 5 * 60 * 1000; // 5 minutes grace period
    const { start, end } = getTimeSlotWindow(lessonDate, timeSlot);
    
    return now >= new Date(start.getTime() - gracePeriod) && 
           now <= new Date(end.getTime() + gracePeriod);
};

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
        const existingBookingsCount = await Booking.countDocuments({ lesson: lessonId, paymentStatus: { $ne: 'refunded' } });
        
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
        const userBookings = await Booking.find({ user: userId, paymentStatus: { $ne: 'refunded' } }).populate('lesson');
        
        const hasConflict = userBookings.some(booking => {
            return booking.lesson.day === lessonToBook.day && 
                   booking.lesson.timeSlot === lessonToBook.timeSlot &&
                   booking.lesson.date.getTime() === lessonToBook.date.getTime(); // Same weekend check
        });

        if (hasConflict) {
            return res.status(400).json({ message: "Time conflict! You already have a class scheduled at this time." });
        }

        // ---------------------------------------------------------
        // FINAL STEP: SAVE THE BOOKING WITH PAYMENT
        // ---------------------------------------------------------
        // Pehle Exercise ki detail lao taake price pata chal sake
        const exerciseDetail = await Lesson.findById(lessonId).populate('exercise');
        const paymentAmount = exerciseDetail.exercise.price || 0;
        
        // Agar dono checks pass ho gaye, toh finally booking create kar dein!
        const newBooking = new Booking({
            user: userId,
            lesson: lessonId,
            paymentStatus: 'paid',  // Payment recorded
            paymentAmount: paymentAmount  // Store exercise price
        });

        await newBooking.save();

        res.status(201).json({ 
            message: "Lesson booked successfully! Payment received.", 
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
        const myBookings = await Booking.find({ user: userId, paymentStatus: { $ne: 'refunded' } })
            .populate({
                path: 'lesson',           // Pehle Lesson ka data lao
                populate: {               // Phir us Lesson ke ANDAR jao...
                    path: 'exercise',     // ...aur uski Exercise ka data bhi lao!
                    model: 'Exercise'
                }
            });

        // ✅ NEW: Add status information for each booking
        const enrichedBookings = myBookings.map(booking => {
            const now = new Date();
            const lessonDate = new Date(booking.lesson.date);
            const isSameDay = now.getFullYear() === lessonDate.getFullYear() &&
                            now.getMonth() === lessonDate.getMonth() &&
                            now.getDate() === lessonDate.getDate();
            
            // Check if currently in access window
            const hasCurrentAccess = canAccessVideo(booking.lesson.date, booking.lesson.timeSlot);
            
            // Check if lesson time has passed
            const lessonPassed = now > lessonDate;
            
            // Check rewatch deadline
            let canRewatch = false;
            let rewatchDeadline = null;
            if (booking.isCompleted && booking.completedAt) {
                rewatchDeadline = new Date(booking.completedAt);
                rewatchDeadline.setHours(rewatchDeadline.getHours() + 24);
                canRewatch = now < rewatchDeadline;
            }
            
            return {
                ...booking.toObject(),
                // ✅ Status info
                status: {
                    hasCurrentAccess: hasCurrentAccess,
                    isPassed: lessonPassed,
                    canRewatch: canRewatch,
                    rewatchDeadline: rewatchDeadline
                }
            };
        });

        res.status(200).json({
            count: enrichedBookings.length,
            bookings: enrichedBookings
        });

    } catch (error) {
        console.error("Error fetching user bookings: ", error);
        res.status(500).json({ message: "Server Error while fetching your bookings" });
    }
});
router.delete('/:id', protect, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id).populate('lesson');
        if (!booking) return res.status(404).json({ message: "Booking nahi mili" });

        // Security: Sirf wahi user delete kare jiski booking hai
        if (booking.user.toString() !== req.user.userId) {
            return res.status(403).json({ message: "Aap kisi aur ki booking delete nahi kar sakte!" });
        }

        // 💰 REFUND LOGIC: Check if class time has passed
        const now = new Date();
        const lessonDate = new Date(booking.lesson.date);
        
        // Check if time window has passed
        let timePassed = false;
        if (booking.lesson.timeSlot === 'Morning' && now.getHours() >= 11) timePassed = true;
        if (booking.lesson.timeSlot === 'Afternoon' && now.getHours() >= 15) timePassed = true;
        if (booking.lesson.timeSlot === 'Evening' && now.getHours() >= 19) timePassed = true;
        
        // Also check if date has passed
        if (now.getDate() > lessonDate.getDate() || now.getMonth() > lessonDate.getMonth() || now.getFullYear() > lessonDate.getFullYear()) {
            timePassed = true;
        }

        // Mark as refunded with refund amount
        booking.paymentStatus = 'refunded';
        booking.refundedAmount = booking.paymentAmount;  // Full refund
        booking.refundedAt = new Date();
        
        await booking.save();

        res.json({ 
            message: `Booking cancel ho gayi! Refund: ${booking.refundedAmount} PKR processed.`,
            refundedAmount: booking.refundedAmount
        });
    } catch (error) {
        console.error("Cancel Error:", error);
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
        const count = await Booking.countDocuments({ lesson: newLessonId, paymentStatus: { $ne: 'refunded' } });
        if (count >= 4) return res.status(400).json({ message: "Nayi class full hai!" });

        // 2. Conflict check (Purani booking ko chor kar)
        const userBookings = await Booking.find({ user: req.user.userId, _id: { $ne: bookingId }, paymentStatus: { $ne: 'refunded' } }).populate('lesson');
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

        // 3. TIME VALIDATION: Check karein ke kya user apne lesson ke time slot ke doran ya baad mein mark kar raha hai
        const now = new Date();
        const timeSlot = booking.lesson.timeSlot;
        
        // ✅ NEW: Use helper function with grace period
        const hasAccess = canAccessVideo(booking.lesson.date, timeSlot);
        
        if (!hasAccess) {
            // ✅ NEW: But allow manual completion with force flag
            const { req_body } = require('express');
            // (For mobile/app: can pass force=true to override, but we keep it false for web)
            return res.status(403).json({ 
                message: `Video access window closed! Time slot was ${timeSlot}. Reload page to try manual mark.`,
                canManualMark: true // Frontend can show "Mark Complete Manually" button
            });
        }

        // 4. IDEMPOTENT: Agar pehle se complete hai toh just return karein
        if (booking.isCompleted) {
            // ✅ Calculate rewatch deadline (24 hours from completion)
            const rewatchDeadline = new Date(booking.completedAt);
            rewatchDeadline.setHours(rewatchDeadline.getHours() + 24);
            
            return res.status(200).json({ 
                message: "Already completed! This is a rewatch.",
                isRewatch: true,
                rewatchDeadline: rewatchDeadline,
                booking: booking
            });
        }

        // 5. MARK AS COMPLETE (First time)
        booking.isCompleted = true;
        booking.completedAt = new Date();
        await booking.save();
        
        // ✅ Calculate rewatch deadline for new completion
        const rewatchDeadline = new Date(booking.completedAt);
        rewatchDeadline.setHours(rewatchDeadline.getHours() + 24);

        return res.status(200).json({ 
            message: "Lesson marked as complete! Congratulations! 🎉",
            isRewatch: false,
            rewatchDeadline: rewatchDeadline,
            booking: booking
        });

    } catch (error) {
        console.error("Error marking lesson complete: ", error);
        res.status(500).json({ message: "Server Error while marking lesson complete" });
    }
});

// Route: DELETE /api/lessons/:id

module.exports = router;