const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
    exercise: {
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Exercise',                      
        required: true
    },
    day: {
        type: String,
        enum: ['Saturday', 'Sunday'],
        required: true
    },
    timeSlot: {
        type: String,
        enum: ['Morning', 'Afternoon', 'Evening'],
        required: true
    },
    date: {
        type: Date,
        required: true 
    }
}, { timestamps: true });

const Lesson = mongoose.model('Lesson', lessonSchema);
module.exports = Lesson;