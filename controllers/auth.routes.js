const router = require('express').Router()
const bcrypt = require('bcrypt')
const User = require('../models/User')
const { BAHRAIN_NEIGHBORHOODS } = User
const createUserToken = require('../utils/create-user-token')

router.post('/sign-up', async (req, res) => {
  try {
    const { username, password, neighborhood, customNeighborhood, adultConfirmed } = req.body
    if (typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ err: 'Username is required.' })
    }
    const trimmedUsername = username.trim()
    if (trimmedUsername.length < 3 || trimmedUsername.length > 30 ||
        !/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      return res.status(400).json({ err: 'Username must be 3–30 letters, numbers, or underscores.' })
    }
    if (typeof password !== 'string' || password.length < 12 || password.length > 72) {
      return res.status(400).json({ err: 'Use a password between 12 and 72 characters.' })
    }
    if (!BAHRAIN_NEIGHBORHOODS.includes(neighborhood)) {
      return res.status(400).json({ err: 'Please select a valid neighbourhood.' })
    }
    if (neighborhood === 'Other' && (typeof customNeighborhood !== 'string' || !customNeighborhood.trim())) {
      return res.status(400).json({ err: 'Please enter your neighbourhood name.' })
    }
    if (adultConfirmed !== true) {
      return res.status(400).json({ err: 'You must confirm that you are 18 or older to join.' })
    }
    if (await User.findOne({ username: trimmedUsername })) {
      return res.status(409).json({ err: 'That username already belongs to an account.' })
    }

    const createdUser = await User.create({
      username: trimmedUsername,
      adultConfirmedAt: new Date(),
      hashedPassword: await bcrypt.hash(password, 12),
      ecoCredits: 100,
      location: {
        type: 'Point',
        coordinates: [50.5860, 26.2154],
        neighborhood,
        ...(neighborhood === 'Other' ? { customNeighborhood: customNeighborhood.trim() } : {})
      }
    })
    const userObject = createdUser.toObject()
    delete userObject.hashedPassword
    delete userObject.phoneNumber
    res.status(201).json({ user: userObject })
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ err: 'That username already belongs to an account.' })
    res.status(500).json({ err: 'Could not create account.' })
  }
})

router.post('/sign-in', async (req, res) => {
  try {
    const { username, password } = req.body
    if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
      return res.status(400).json({ err: 'Username and password are required.' })
    }
    const foundUser = await User.findOne({ username: username.trim() })
    if (!foundUser || !(await bcrypt.compare(password, foundUser.hashedPassword))) {
      return res.status(401).json({ err: 'Username or password is incorrect.' })
    }
    if (foundUser.isDemo) {
      return res.status(403).json({ err: 'Sample accounts are read-only demo content and cannot be signed into.' })
    }
    res.json({ token: createUserToken(foundUser) })
  } catch {
    res.status(500).json({ err: 'Could not sign in.' })
  }
})

module.exports = router
