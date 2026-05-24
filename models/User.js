const mongoose = require('mongoose');

const BAHRAIN_NEIGHBORHOODS = [
  // Capital Governorate
  'Manama', 'Juffair', 'Adliya', 'Seef', 'Sanabis', 'Zinj', 'Salmaniya',
  'Hoora', 'Gudaibiya', 'Umm Al Hassam', 'Ras Rumman', 'Karanah', 'Jidd Hafs',
  // Muharraq Governorate
  'Muharraq', 'Hidd', 'Amwaj Islands', 'Busaiteen', 'Dair', 'Galali', 'Arad',
  // Northern Governorate
  'Saar', 'Budaiya', 'Hamala', 'Janabiyah', 'Barbar', 'Diraz',
  'Bani Jamra', 'Malkiya', 'Sehla', 'Dumistan', 'Jasra', 'Karbabad', 'Tubli',
  // Southern Governorate
  'Riffa', 'East Riffa', 'West Riffa', 'Isa Town', 'Hamad Town',
  "A'ali", 'Sitra', 'Zallaq', 'Askar', 'Jaw', 'Durrat Al Bahrain',
  'Other'
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
      maxlength: 30,
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
        default: [50.5860, 26.2154]
      },
      neighborhood: {
        type: String,
        enum: BAHRAIN_NEIGHBORHOODS,
        default: 'Manama'
      },
      customNeighborhood: {
        type: String,
        trim: true,
        maxlength: 100
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
