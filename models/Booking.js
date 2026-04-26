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
    },
    // 💰 PAYMENT TRACKING
    paymentStatus: {
        type: String,
        enum: ['paid', 'refunded', 'retained'],
        default: 'paid',
        description: "paid = payment received, refunded = user cancelled early, retained = class expired without completion"
    },
    paymentAmount: {
        type: Number,
        default: 0,
        description: "Amount charged for this booking (fetched from exercise price)"
    },
    refundedAmount: {
        type: Number,
        default: 0,
        description: "Amount refunded to user (for early cancellations)"
    },
    refundedAt: {
        type: Date,
        default: null,
        description: "Timestamp when refund was processed"
    }
}, { timestamps: true });

const Booking = mongoose.model('Booking', bookingSchema);
module.exports = Booking;