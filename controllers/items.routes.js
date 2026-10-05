const router = require('express').Router()
const mongoose = require('mongoose')
const Item = require('../models/Item')
const Swap = require('../models/Swap')
const User = require('../models/User')
const verifyToken = require('../middleware/verify-token')
const { getCreditBand, isCreditPriceAllowed } = require('../config/credit-policy')
const approximateCoordinates = require('../utils/approximate-coordinates')
const isValidBahrainCoordinates = require('../utils/bahrain-coordinates')
const isValidImageUrl = require('../utils/valid-image-url')
const isDemoItem = require('../utils/is-demo-item')
const toPublicItem = require('../utils/public-item')

const VALID_CATEGORIES = ['tops', 'bottoms', 'dresses', 'outerwear', 'footwear', 'accessories', 'kids', 'other']
const VALID_CONDITIONS = ['new', 'like-new', 'good', 'fair']
const VALID_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'One Size', 'Kids']

function validateListing(body, req) {
  const { title, description, category, size, condition, images, ecoCreditsPrice, pickupLocation, truthConfirmed } = body
  if (typeof title !== 'string' || title.trim().length < 3 || title.trim().length > 100) {
    return 'Title must be between 3 and 100 characters.'
  }
  if (typeof description !== 'string' || description.trim().length < 20 || description.trim().length > 500) {
    return 'Describe the item honestly in 20–500 characters.'
  }
  if (!VALID_CATEGORIES.includes(category)) return 'Please select a valid category.'
  if (!VALID_CONDITIONS.includes(condition)) return 'Please select a valid condition.'
  if (size && !VALID_SIZES.includes(size)) return 'Please select a valid size.'
  if (!Array.isArray(images) || images.length < 1 || images.length > 5 ||
      images.some(url => !isValidImageUrl(
        url,
        process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`,
        process.env.NODE_ENV === 'production'
      ))) {
    return 'Add 1–5 clear item photos before publishing.'
  }
  const band = getCreditBand(category, condition)
  if (!band || !isCreditPriceAllowed(category, condition, ecoCreditsPrice)) {
    return `Choose a whole-number credit value between ${band?.[0] ?? 1} and ${band?.[1] ?? 0} for this item condition.`
  }
  if (!pickupLocation || !['public', 'private'].includes(pickupLocation.type) ||
      typeof pickupLocation.address !== 'string' || pickupLocation.address.trim().length < 5 ||
      pickupLocation.address.trim().length > 240 || !isValidBahrainCoordinates(pickupLocation.coordinates)) {
    return 'Choose a precise Bahrain pickup point and provide its address or public meetup name.'
  }
  if (typeof pickupLocation.instructions !== 'string' || pickupLocation.instructions.length > 500) {
    return 'Pickup instructions must be 500 characters or fewer.'
  }
  if (truthConfirmed !== true) {
    return 'Confirm that the photos, condition, cleanliness, and item details are accurate.'
  }
  return null
}

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, Math.floor(Number(req.query.page) || 1))
    const limit = Math.min(48, Math.max(1, Math.floor(Number(req.query.limit) || 12)))
    const filter = { status: 'available' }
    if (req.query.neighborhood) filter['location.neighborhood'] = req.query.neighborhood
    if (req.query.category) {
      if (!VALID_CATEGORIES.includes(req.query.category)) {
        return res.status(400).json({ err: 'Unknown category.' })
      }
      filter.category = req.query.category
    }

    const [items, total] = await Promise.all([
      Item.find(filter)
        .select('-pickupLocation')
        .populate('owner', 'username location.neighborhood location.customNeighborhood isDemo')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Item.countDocuments(filter)
    ])
    const publicItems = items.map(item => {
      const result = toPublicItem(item)
      if (result.location) {
        result.location.coordinates = approximateCoordinates(result.location.coordinates)
      }
      return result
    })
    res.json({ items: publicItems, total, page, limit })
  } catch {
    res.status(500).json({ err: 'Could not load listings.' })
  }
})

router.get('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ err: 'Item not found.' })
  try {
    const item = await Item.findById(req.params.id)
      .populate('owner', 'username location.neighborhood location.customNeighborhood badges itemsGivenCount isDemo')
    if (!item) return res.status(404).json({ err: 'Item not found.' })

    const result = toPublicItem(item)
    if (result.location) {
      result.location.coordinates = approximateCoordinates(result.location.coordinates)
    }
    let viewerId = null
    const authorization = req.headers.authorization
    if (authorization) {
      try {
        const jwt = require('jsonwebtoken')
        viewerId = jwt.verify(authorization.split(' ')[1], process.env.JWT_SECRET)?.payload?._id
      } catch {
        viewerId = null
      }
    }
    const isOwner = viewerId && item.owner?._id?.toString() === String(viewerId)
    const activeSwap = viewerId && await Swap.findOne({
      item: item._id,
      status: { $in: ['approved', 'disputed'] },
      $or: [{ requester: viewerId }, { owner: viewerId }]
    }).select('_id')
    if (isOwner || activeSwap) result.pickupLocation = item.pickupLocation
    res.json({ item: result })
  } catch {
    res.status(500).json({ err: 'Could not load this listing.' })
  }
})

router.post('/', verifyToken, async (req, res) => {
  try {
    const owner = await User.findById(req.user._id)
    if (!owner) return res.status(404).json({ err: 'User not found.' })
    if (!owner.phoneVerifiedAt || !owner.adultConfirmedAt) {
      return res.status(403).json({ err: 'Verify your phone and confirm you are 18 or older before listing.' })
    }
    const issue = validateListing(req.body, req)
    if (issue) return res.status(400).json({ err: issue })

    const item = await Item.create({
      owner: owner._id,
      title: req.body.title.trim(),
      description: req.body.description.trim(),
      category: req.body.category,
      size: req.body.size || undefined,
      condition: req.body.condition,
      images: req.body.images,
      ecoCreditsPrice: Number(req.body.ecoCreditsPrice),
      location: {
        type: 'Point',
        coordinates: req.body.pickupLocation.coordinates.map(value => Math.round(Number(value) * 100) / 100),
        neighborhood: owner.location.neighborhood,
        ...(owner.location.customNeighborhood ? { customNeighborhood: owner.location.customNeighborhood } : {})
      },
      pickupLocation: {
        ...req.body.pickupLocation,
        address: req.body.pickupLocation.address.trim(),
        instructions: req.body.pickupLocation.instructions.trim()
      },
      isDemo: false
    })
    res.status(201).json({ item })
  } catch {
    res.status(500).json({ err: 'Could not create listing.' })
  }
})

router.patch('/:id', verifyToken, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id)
    if (!item) return res.status(404).json({ err: 'Item not found.' })
    if (item.owner.toString() !== String(req.user._id)) return res.status(403).json({ err: 'Not authorized.' })
    if (item.status !== 'available') return res.status(409).json({ err: 'Only available listings can be edited.' })
    if (isDemoItem(item)) return res.status(403).json({ err: 'Demo listings cannot be edited.' })

    const candidate = {
      title: req.body.title ?? item.title,
      description: req.body.description ?? item.description,
      category: req.body.category ?? item.category,
      size: req.body.size ?? item.size,
      condition: req.body.condition ?? item.condition,
      images: req.body.images ?? item.images,
      ecoCreditsPrice: req.body.ecoCreditsPrice ?? item.ecoCreditsPrice,
      pickupLocation: req.body.pickupLocation ?? item.pickupLocation,
      truthConfirmed: req.body.truthConfirmed
    }
    const issue = validateListing(candidate, req)
    if (issue) return res.status(400).json({ err: issue })

    const updated = await Item.findOneAndUpdate(
      { _id: item._id, owner: req.user._id, status: 'available' },
      {
        $set: {
          title: candidate.title.trim(),
          description: candidate.description.trim(),
          category: candidate.category,
          size: candidate.size || undefined,
          condition: candidate.condition,
          images: candidate.images,
          ecoCreditsPrice: Number(candidate.ecoCreditsPrice),
          pickupLocation: {
            ...candidate.pickupLocation,
            address: candidate.pickupLocation.address.trim(),
            instructions: candidate.pickupLocation.instructions.trim()
          }
        }
      },
      { new: true, runValidators: true }
    )
    if (!updated) return res.status(409).json({ err: 'Listing changed while you were editing. Reload and try again.' })
    res.json({ item: updated })
  } catch {
    res.status(500).json({ err: 'Could not save listing changes.' })
  }
})

router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id)
    if (!item) return res.status(404).json({ err: 'Item not found.' })
    if (item.owner.toString() !== String(req.user._id)) return res.status(403).json({ err: 'Not authorized.' })
    if (item.status !== 'available') {
      return res.status(409).json({ err: 'A requested or completed listing cannot be deleted.' })
    }
    if (isDemoItem(item)) return res.status(403).json({ err: 'Demo listings cannot be deleted.' })
    await item.deleteOne()
    res.json({ message: 'Listing deleted.' })
  } catch {
    res.status(500).json({ err: 'Could not delete listing.' })
  }
})

module.exports = router
