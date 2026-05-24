const mongoose = require('mongoose');

const BAHRAIN_NEIGHBORHOODS = [
  'Manama', 'Juffair', 'Adliya', 'Seef', 'Sanabis', 'Tubli',
  'Muharraq', 'Hidd', 'Amwaj Islands',
  'Riffa', 'Isa Town', 'Hamad Town', 'Saar', 'Budaiya',
  'Zinj', 'Salmaniya', 'A\'ali', 'Sitra', 'Other'
];

const BADGE_NAMES = ['Eco Starter', 'Green Giver', 'Sustainability Hero', 'Bahrain Eco Champion'];

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
    },
    hashedPassword: {
      type: String,
      required: true
    },
    ecoCredits: {
      type: Number,
      default: 100,
      min: 0
    },
    badges: {
      type: [{ type: String, enum: BADGE_NAMES }],
      default: []
    },
    itemsGivenCount: {
      type: Number,
      default: 0
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        default: [50.5860, 26.2154]  // Manama city center default
      },
      neighborhood: {
        type: String,
        enum: BAHRAIN_NEIGHBORHOODS,
        default: 'Manama'
      }
    }
  },
  { timestamps: true }
);

userSchema.index({ location: '2dsphere' });

userSchema.set('toJSON', {
    transform: (document, returnedObject) => {
        delete returnedObject.hashedPassword;
    }
});

module.exports = mongoose.model('User', userSchema);
module.exports.BAHRAIN_NEIGHBORHOODS = BAHRAIN_NEIGHBORHOODS;
module.exports.BADGE_NAMES = BADGE_NAMES;