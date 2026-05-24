const mongoose = require('mongoose');
const { BADGE_NAMES } = require('./User');

const ECO_CREDITS_EARNED_PER_GIVE = 30;
const BADGE_THRESHOLDS = [
  { count: 1,  badge: 'Eco Starter' },
  { count: 5,  badge: 'Green Giver' },
  { count: 15, badge: 'Sustainability Hero' },
  { count: 30, badge: 'Bahrain Eco Champion' }
];

const swapSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['requested', 'approved', 'completed', 'cancelled'],
      default: 'requested'
    },
    creditsSpentByRequester: { type: Number, default: 10 },
    creditsEarnedByOwner: { type: Number, default: ECO_CREDITS_EARNED_PER_GIVE },
    badgesUnlocked: {
      type: [{ type: String, enum: BADGE_NAMES }],
      default: []
    },
    pickupDetails: {
      agreedTime: { type: Date },
      notes: { type: String, trim: true, maxlength: 500 }
    },
    // Owner's reply message to the requester
    ownerResponse: { type: String, trim: true, maxlength: 500 },
    // Populated when owner declines (cancels on their side)
    cancelReason: { type: String, trim: true, maxlength: 300 },
    cancelledBy: { type: String, enum: ['owner', 'requester', null], default: null },
    completedAt: { type: Date }
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
