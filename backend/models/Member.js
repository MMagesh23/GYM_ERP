const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema(
  {
    memberId: { type: String, required: true, unique: true }, // auto-generated e.g. GYM001
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true },
    photo: { type: String, default: '' },
    gender: { type: String, enum: ['male', 'female', 'other'], required: true },
    dob: { type: Date },
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', ''],
      default: '',
    },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, default: '' },
    emergencyContact: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
      relation: { type: String, default: '' },
    },

    height: { type: Number }, // cm
    weight: { type: Number }, // kg
    bmi: { type: Number },
    medicalConditions: { type: String, default: '' },
    occupation: { type: String, default: '' },

    joiningDate: { type: Date, default: Date.now },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', default: null },
    notes: { type: String, default: '' },

    status: {
      type: String,
      enum: ['active', 'expired', 'suspended', 'freeze', 'cancelled'],
      default: 'active',
      index: true,
    },

    currentMembership: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', default: null },

    qrCode: { type: String, default: '' }, // data URL / cloud URL for check-in QR

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false }, // soft delete
  },
  { timestamps: true }
);

memberSchema.pre('save', function (next) {
  if (this.height && this.weight) {
    const heightM = this.height / 100;
    this.bmi = Number((this.weight / (heightM * heightM)).toFixed(2));
  }
  next();
});

memberSchema.index({ firstName: 'text', lastName: 'text', phone: 'text', email: 'text' });

module.exports = mongoose.model('Member', memberSchema);
