const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, unique: true }, // e.g. EMP001
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // linked login account
    name: { type: String, required: true },
    photo: { type: String, default: '' },
    mobile: { type: String, required: true },
    email: { type: String, default: '' },
    address: { type: String, default: '' },
    designation: { type: String, default: 'Receptionist' },
    salary: { type: Number, default: 0 },
    joiningDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Staff', staffSchema);
