const mongoose = require('mongoose');

const maintenanceSchema = new mongoose.Schema(
  {
    equipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipment', required: true, index: true },
    type: { type: String, enum: ['scheduled_service', 'repair', 'inspection'], default: 'scheduled_service' },
    description: { type: String, default: '' },
    serviceDate: { type: Date, required: true },
    nextServiceDate: { type: Date },
    cost: { type: Number, default: 0 },
    vendor: { type: String, default: '' },
    status: { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Maintenance', maintenanceSchema);
