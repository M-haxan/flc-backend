const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',   // User model ko link kar raha hai
        required: true
    },
    lesson: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lesson', // Lesson (timetable slot) ko link kar raha hai
        required: true
    },
    isCompleted: {
        type: Boolean,
        default: false,
        description: "Tracks if user has completed watching the lesson"
    },
    completedAt: {
        type: Date,
        default: null,
        description: "Timestamp when the lesson was marked as complete"
    }
}, { timestamps: true });

const Booking = mongoose.model('Booking', bookingSchema);
module.exports = Booking;