const router = require('express').Router()
const Item = require('../models/Item')
const User = require('../models/User')
const verifyToken = require('../middleware/verify-token')

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
// Item location is inherited from the owner's saved neighborhood
router.post('/', verifyToken, async (req, res) => {
  try {
    const { title, description, category, size, condition, images, ecoCreditsPrice, tags } = req.body

    const owner = await User.findById(req.user._id)
    if (!owner) return res.status(404).json({ err: 'User not found' })

    const item = await Item.create({
      owner: owner._id,
      title,
      description,
      category,
      size,
      condition,
      images: images || [],
      ecoCreditsPrice: ecoCreditsPrice ?? 10,
      tags: tags || [],
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
