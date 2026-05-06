const mongoose = require('mongoose');

const bottleScanSchema = mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true
    },
    qrRaw: {
        type: String,
        required: true
    },
    bottleName: {
        type: String,
        default: ''
    },
    totalCapacityLiters: {
        type: Number,
        default: 0
    },
    consumedLiters: {
        type: Number,
        default: 0
    },
    color: {
        type: String,
        default: ''
    },
    material: {
        type: String,
        default: ''
    },
    rawPayload: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('bottle_scans', bottleScanSchema);
