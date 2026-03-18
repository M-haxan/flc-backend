const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    lesson: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lesson',
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,  // Ensures rating cannot be less than 1
        max: 5   // Ensures rating cannot be more than 5
    },
    comment: {
        type: String,
        trim: true
        // required: false likhne ki zaroorat nahi, Mongoose mein default false hi hota hai.
        // Ho sakta hai user sirf 5-star de aur text na likhe.
    }
}, { timestamps: true });

const Review = mongoose.model('Review', reviewSchema);
module.exports = Review;