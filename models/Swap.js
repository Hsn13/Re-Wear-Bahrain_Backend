const mongoose = require('mongoose');
const { BADGE_NAMES } = require('./User');

// Eco-credit award per completed give, and badge unlock thresholds
const ECO_CREDITS_EARNED_PER_GIVE = 30;
const BADGE_THRESHOLDS = [
  { count: 1,  badge: 'Eco Starter' },
  { count: 5,  badge: 'Green Giver' },
  { count: 15, badge: 'Sustainability Hero' },
  { count: 30, badge: 'Bahrain Eco Champion' }
];

const swapSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Item',
      required: true
    },
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: ['requested', 'approved', 'completed', 'cancelled'],
      default: 'requested'
    },
    creditsSpentByRequester: {
      type: Number,
      default: 10
    },
    creditsEarnedByOwner: {
      type: Number,
      default: ECO_CREDITS_EARNED_PER_GIVE
    },
    badgesUnlocked: {
      type: [{ type: String, enum: BADGE_NAMES }],
      default: []
    },
    pickupDetails: {
      agreedTime: { type: Date },
      notes: { type: String, maxlength: 300 }
    },
    completedAt: {
      type: Date
    }
  },
  { timestamps: true }
);

swapSchema.index({ item: 1 });
swapSchema.index({ requester: 1 });
swapSchema.index({ owner: 1 });
swapSchema.index({ status: 1 });

module.exports = mongoose.model('Swap', swapSchema);
module.exports.ECO_CREDITS_EARNED_PER_GIVE = ECO_CREDITS_EARNED_PER_GIVE;
module.exports.BADGE_THRESHOLDS = BADGE_THRESHOLDS;
