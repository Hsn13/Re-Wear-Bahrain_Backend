const router = require('express').Router()
const User = require('../models/User')
const { BAHRAIN_NEIGHBORHOODS } = User
const Item = require('../models/Item')
const verifyToken = require('../middleware/verify-token')
const createUserToken = require('../utils/create-user-token')
const { isModerator } = require('./swap-helpers')
const approximateCoordinates = require('../utils/approximate-coordinates')
const toPublicItem = require('../utils/public-item')

router.get('/me/profile', verifyToken, async (req, res) => {
  try {
    const [user, items] = await Promise.all([
      User.findById(req.user._id).select('-hashedPassword'),
      Item.find({ owner: req.user._id }).sort({ createdAt: -1 })
    ])
    if (!user) return res.status(404).json({ err: 'User not found' })
    res.json({ user, items, isModerator: isModerator(req.user._id) })
  } catch (err) {
    res.status(500).json({ err: err.message })
  }
})

router.patch('/me/adult-confirmation', verifyToken, async (req, res) => {
  if (req.body.confirmed !== true) {
    return res.status(400).json({ err: 'Confirm that you are 18 or older.' })
  }
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { adultConfirmedAt: new Date() },
      { new: true }
    ).select('-hashedPassword -phoneNumber')
    if (!user) return res.status(404).json({ err: 'Account not found.' })
    return res.json({ user, token: createUserToken(user) })
  } catch {
    return res.status(500).json({ err: 'Could not update account confirmation.' })
  }
})

router.patch('/me/location', verifyToken, async (req, res) => {
  try {
    const { neighborhood, customNeighborhood, coordinates } = req.body

    if (!neighborhood || !BAHRAIN_NEIGHBORHOODS.includes(neighborhood)) {
      return res.status(400).json({ err: 'Please select a valid neighbourhood' })
    }
    if (neighborhood === 'Other' && (!customNeighborhood || !customNeighborhood.trim())) {
      return res.status(400).json({ err: 'Please enter your neighbourhood name' })
    }

    const location = {
      type: 'Point',
      coordinates: Array.isArray(coordinates) && coordinates.length === 2
        ? coordinates
        : [50.5860, 26.2154],
      neighborhood,
      ...(neighborhood === 'Other' && customNeighborhood
        ? { customNeighborhood: customNeighborhood.trim() }
        : { customNeighborhood: undefined })
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { location },
      { new: true }
    ).select('-hashedPassword')
    res.json({ user })
  } catch (err) {
    res.status(500).json({ err: err.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('username badges itemsGivenCount location.neighborhood location.customNeighborhood')
    if (!user) return res.status(404).json({ err: 'User not found' })
    res.json({ user })
  } catch (err) {
    res.status(500).json({ err: err.message })
  }
})

router.get('/:id/items', async (req, res) => {
  try {
    const items = await Item.find({ owner: req.params.id, status: 'available' })
      .select('-pickupLocation')
      .sort({ createdAt: -1 })
    const publicItems = items.map(item => {
      const result = toPublicItem(item)
      if (result.location) {
        result.location.coordinates = approximateCoordinates(result.location.coordinates)
      }
      return result
    })
    res.json({ items: publicItems })
  } catch (err) {
    res.status(500).json({ err: err.message })
  }
})

module.exports = router
