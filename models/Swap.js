const mongoose = require('mongoose');
const crypto = require('crypto');
const { BADGE_NAMES } = require('./User');

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
      enum: ['requested', 'approved', 'completed', 'cancelled', 'disputed'],
      default: 'requested'
    },
    creditsSpentByRequester: { type: Number, required: true, min: 1 },
    handoverCodeHash: { type: String, select: false },
    handoverCodeExpiresAt: { type: Date, default: null },
    handoverCodeAttempts: { type: Number, default: 0 },
    requesterConfirmedAt: { type: Date, default: null },
    ownerConfirmedAt: { type: Date, default: null },
    disputedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    disputeReason: { type: String, trim: true, maxlength: 1000 },
    disputeResolution: {
      action: { type: String, enum: ['refund', 'complete', null], default: null },
      note: { type: String, trim: true, maxlength: 1000 },
      moderatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      resolvedAt: { type: Date, default: null }
    },
    messages: {
      type: [{
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        text: { type: String, trim: true, required: true, maxlength: 1000 },
        createdAt: { type: Date, default: Date.now }
      }],
      default: []
    },
    reviews: {
      type: [{
        reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        rating: { type: Number, required: true, min: 1, max: 5 },
        comment: { type: String, trim: true, maxlength: 500, default: '' },
        createdAt: { type: Date, default: Date.now }
      }],
      default: []
    },
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
module.exports.BADGE_THRESHOLDS = BADGE_THRESHOLDS;
