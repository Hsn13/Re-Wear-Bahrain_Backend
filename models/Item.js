const mongoose = require('mongoose');
const { BAHRAIN_NEIGHBORHOODS } = require('./User');

const itemSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500
    },
    category: {
      type: String,
      required: true,
      enum: ['tops', 'bottoms', 'dresses', 'outerwear', 'footwear', 'accessories', 'kids', 'other']
    },
    size: {
      type: String,
      enum: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'One Size', 'Kids']
    },
    condition: {
      type: String,
      required: true,
      enum: ['new', 'like-new', 'good', 'fair']
    },
    images: {
      type: [String],
      required: true,
      validate: {
        validator: images => images.length >= 1 && images.length <= 5,
        message: 'Listings require 1–5 photos'
      }
    },
    status: {
      type: String,
      enum: ['available', 'pending', 'claimed'],
      default: 'available'
    },
    ecoCreditsPrice: {
      type: Number,
      default: 10,
      min: 1
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        required: true  // [longitude, latitude]
      },
      neighborhood: {
        type: String,
        enum: BAHRAIN_NEIGHBORHOODS,
        required: true
      },
      customNeighborhood: {
        type: String,
        trim: true,
        maxlength: 100
      }
    },
    pickupLocation: {
      type: {
        type: String,
        enum: ['public', 'private'],
        required: true
      },
      coordinates: {
        type: [Number],
        required: true
      },
      address: {
        type: String,
        required: true,
        trim: true,
        maxlength: 240
      },
      instructions: {
        type: String,
        trim: true,
        maxlength: 500,
        default: ''
      }
    },
    isDemo: { type: Boolean, default: false },
    tags: {
      type: [String],
      default: []
    }
  },
  { timestamps: true }
);

itemSchema.index({ location: '2dsphere' });
itemSchema.index({ status: 1 });
itemSchema.index({ owner: 1 });
itemSchema.index({ isDemo: 1 });

module.exports = mongoose.model('Item', itemSchema);
