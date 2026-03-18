const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    }
}, { timestamps: true });

const Exercise = mongoose.model('Exercise', exerciseSchema);
module.exports = Exercise;