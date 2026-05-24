const router = require('express').Router()
const User = require('../models/User')
const { BAHRAIN_NEIGHBORHOODS } = User
const Item = require('../models/Item')
const verifyToken = require('../middleware/verify-token')

// GET /users/me/profile — logged-in user's own full profile + listings
// MUST be defined before /:id or Express will match "me" as a user ID
router.get('/me/profile', verifyToken, async (req, res) => {
  try {
    const [user, items] = await Promise.all([
      User.findById(req.user._id).select('-hashedPassword'),
      Item.find({ owner: req.user._id }).sort({ createdAt: -1 })
    ])
    if (!user) return res.status(404).json({ err: 'User not found' })
    res.json({ user, items })
  } catch (err) {
    res.status(500).json({ err: err.message })
  }
})

// PATCH /users/me/location — update logged-in user's neighborhood
router.patch('/me/location', verifyToken, async (req, res) => {
  try {
    const { neighborhood, coordinates } = req.body
    if (!BAHRAIN_NEIGHBORHOODS.includes(neighborhood)) {
      return res.status(400).json({ err: 'Invalid neighborhood' })
    }
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { location: { type: 'Point', coordinates: coordinates || [50.5860, 26.2154], neighborhood } },
      { new: true }
    ).select('-hashedPassword')
    res.json({ user })
  } catch (err) {
    res.status(500).json({ err: err.message })
  }
})

// GET /users/:id — public profile with stats
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-hashedPassword')
    if (!user) return res.status(404).json({ err: 'User not found' })
    res.json({ user })
  } catch (err) {
    res.status(500).json({ err: err.message })
  }
})

// GET /users/:id/items — all listings by a user
router.get('/:id/items', async (req, res) => {
  try {
    const items = await Item.find({ owner: req.params.id }).sort({ createdAt: -1 })
    res.json({ items })
  } catch (err) {
    res.status(500).json({ err: err.message })
  }
})

module.exports = router
