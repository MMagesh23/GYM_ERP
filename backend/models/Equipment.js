const mongoose = require('mongoose');

const equipmentSchema = new mongoose.Schema(
  {
    equipmentId: { type: String, required: true, unique: true }, // e.g. EQP001
    name: { type: String, required: true },
    category: { type: String, required: true }, // e.g. Cardio, Strength, Free Weights
    brand: { type: String, default: '' },
    model: { type: String, default: '' },
    serialNumber: { type: String, default: '' },
    quantity: { type: Number, default: 1 },

    purchaseDate: { type: Date },
    purchaseCost: { type: Number, default: 0 },
    supplier: { type: String, default: '' },

    warrantyStart: { type: Date },
    warrantyEnd: { type: Date },

    status: {
      type: String,
      enum: ['active', 'under_maintenance', 'damaged', 'repaired', 'retired'],
      default: 'active',
      index: true,
    },
    location: { type: String, default: '' },
    notes: { type: String, default: '' },

    photo: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Equipment', equipmentSchema);
