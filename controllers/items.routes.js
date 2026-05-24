const router = require('express').Router()
const Item = require('../models/Item')
const User = require('../models/User')
const verifyToken = require('../middleware/verify-token')

const VALID_CATEGORIES = ['tops', 'bottoms', 'dresses', 'outerwear', 'footwear', 'accessories', 'kids', 'other']
const VALID_CONDITIONS = ['new', 'like-new', 'good', 'fair']
const VALID_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'One Size', 'Kids']

// GET /items — browse available items, filter by neighborhood / category
router.get('/', async (req, res) => {
  try {
    const { neighborhood, category, page = 1, limit = 20 } = req.query
    const filter = { status: 'available' }
    if (neighborhood) filter['location.neighborhood'] = neighborhood
    if (category) filter.category = category

    const items = await Item.find(filter)
      .populate('owner', 'username location')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))

    const total = await Item.countDocuments(filter)
    res.json({ items, total })
  } catch (err) {
    res.status(500).json({ err: err.message })
  }
})

// GET /items/:id — single item detail
router.get('/:id', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id)
      .populate('owner', 'username location badges ecoCredits')
    if (!item) return res.status(404).json({ err: 'Item not found' })
    res.json({ item })
  } catch (err) {
    res.status(500).json({ err: err.message })
  }
})

// POST /items — create a new listing (protected)
router.post('/', verifyToken, async (req, res) => {
  try {
    const { title, description, category, size, condition, images, ecoCreditsPrice, tags } = req.body

    // --- Validate required fields ---
    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      return res.status(400).json({ err: 'Title must be at least 3 characters' })
    }
    if (title.trim().length > 100) {
      return res.status(400).json({ err: 'Title must be 100 characters or fewer' })
    }
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ err: 'Please select a valid category' })
    }
    if (!condition || !VALID_CONDITIONS.includes(condition)) {
      return res.status(400).json({ err: 'Please select a valid condition' })
    }
    if (size && !VALID_SIZES.includes(size)) {
      return res.status(400).json({ err: 'Please select a valid size' })
    }
    if (ecoCreditsPrice !== undefined) {
      const price = Number(ecoCreditsPrice)
      if (isNaN(price) || price < 0 || price > 50) {
        return res.status(400).json({ err: 'Credits to claim must be between 0 and 50' })
      }
    }

    const owner = await User.findById(req.user._id)
    if (!owner) return res.status(404).json({ err: 'User not found' })

    const item = await Item.create({
      owner: owner._id,
      title: title.trim(),
      description: description ? description.trim() : '',
      category,
      size: size || undefined,
      condition,
      images: Array.isArray(images) ? images.filter(Boolean) : [],
      ecoCreditsPrice: ecoCreditsPrice !== undefined ? Number(ecoCreditsPrice) : 10,
      tags: Array.isArray(tags) ? tags : [],
      location: owner.location
    })

    res.status(201).json({ item })
  } catch (err) {
    res.status(500).json({ err: err.message })
  }
})

// DELETE /items/:id — delete listing (owner only)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id)
    if (!item) return res.status(404).json({ err: 'Item not found' })
    if (item.owner.toString() !== req.user._id) {
      return res.status(403).json({ err: 'Not authorized' })
    }
    if (item.status === 'pending') {
      return res.status(400).json({ err: 'Cannot delete an item with a pending swap request' })
    }
    await item.deleteOne()
    res.json({ message: 'Item deleted' })
  } catch (err) {
    res.status(500).json({ err: err.message })
  }
})

module.exports = router
