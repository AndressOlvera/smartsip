const mongoose = require('mongoose');

const actionSchema = mongoose.Schema({
    actionType: String,
    amountLiters: Number,
    category: String,
    bottleName: String,
    qrRaw: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const dailyConsumptionSchema = mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true
    },
    dateKey: {
        type: String,
        required: true
    },
    consumedLiters: {
        type: Number,
        default: 0
    },
    actions: {
        type: [actionSchema],
        default: []
    }
}, {
    timestamps: true
});

dailyConsumptionSchema.index({ userId: 1, dateKey: 1 }, { unique: true });

module.exports = mongoose.model('daily_consumptions', dailyConsumptionSchema);
