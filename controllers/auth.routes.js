const router = require('express').Router()
const bcrypt = require('bcrypt')
const UserModel = require('../models/User')
const User = UserModel
const { BAHRAIN_NEIGHBORHOODS } = UserModel
const jwt = require('jsonwebtoken')

// POST /auth/sign-up
router.post('/sign-up', async (req, res) => {
  try {
    const { username, password, neighborhood, customNeighborhood, coordinates } = req.body

    // --- Validate username ---
    if (!username || typeof username !== 'string' || !username.trim()) {
      return res.status(400).json({ err: 'Username is required' })
    }
    const trimmedUsername = username.trim()
    if (trimmedUsername.length < 3 || trimmedUsername.length > 30) {
      return res.status(400).json({ err: 'Username must be 3–30 characters' })
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      return res.status(400).json({ err: 'Username may only contain letters, numbers and underscores' })
    }

    // --- Validate password ---
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ err: 'Password is required' })
    }
    if (password.length < 6) {
      return res.status(400).json({ err: 'Password must be at least 6 characters' })
    }
    if (password.length > 72) {
      return res.status(400).json({ err: 'Password must be 72 characters or fewer' })
    }

    // --- Validate neighborhood ---
    if (!neighborhood || !BAHRAIN_NEIGHBORHOODS.includes(neighborhood)) {
      return res.status(400).json({ err: 'Please select a valid neighbourhood' })
    }
    if (neighborhood === 'Other' && (!customNeighborhood || !customNeighborhood.trim())) {
      return res.status(400).json({ err: 'Please enter your neighbourhood name' })
    }

    // --- Check username availability ---
    const foundUser = await User.findOne({ username: trimmedUsername })
    if (foundUser) {
      return res.status(409).json({ err: 'Username already taken — please choose another' })
    }

    // --- Build location ---
    const location = {
      type: 'Point',
      coordinates: Array.isArray(coordinates) && coordinates.length === 2
        ? coordinates
        : [50.5860, 26.2154],
      neighborhood,
      ...(neighborhood === 'Other' && customNeighborhood
        ? { customNeighborhood: customNeighborhood.trim() }
        : {})
    }

    // --- Create user with 100 starter Eco-Credits ---
    const createdUser = await User.create({
      username: trimmedUsername,
      hashedPassword: bcrypt.hashSync(password, 12),
      ecoCredits: 100,
      location
    })

    const userObject = createdUser.toObject()
    delete userObject.hashedPassword
    res.status(201).json({ user: userObject })
  } catch (err) {
    console.log(err)
    res.status(500).json({ err: err.message })
  }
})

// POST /auth/sign-in
router.post('/sign-in', async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ err: 'Username and password are required' })
    }

    const foundUser = await User.findOne({ username: username.trim() })
    if (!foundUser) {
      return res.status(401).json({ err: 'Username or password is incorrect' })
    }

    const doesPasswordMatch = bcrypt.compareSync(password, foundUser.hashedPassword)
    if (!doesPasswordMatch) {
      return res.status(401).json({ err: 'Username or password is incorrect' })
    }

    const payload = foundUser.toObject()
    delete payload.hashedPassword

    const token = jwt.sign({ payload }, process.env.JWT_SECRET, { expiresIn: '24h' })
    res.json({ token })
  } catch (err) {
    console.log(err)
    res.status(500).json({ err: err.message })
  }
})

module.exports = router
