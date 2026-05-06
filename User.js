const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    secondName: {
        type: String,
        default: '',
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    dailyGoalLiters: {
        type: Number,
        default: null
    },
    goalType: {
        type: String,
        default: ''
    },
    weightKg: {
        type: Number,
        default: null
    },
    exerciseLevel: {
        type: String,
        default: ''
    },
    darkMode: {
        type: Boolean,
        default: false
    },
    profileImage: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('users', userSchema);
