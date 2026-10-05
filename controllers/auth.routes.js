const router = require('express').Router()
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { BAHRAIN_NEIGHBORHOODS } = User
const createUserToken = require('../utils/create-user-token')
function normalizeBahrainPhone(value) {
  const phone = String(value || '').replace(/[\s()-]/g, '')
  return /^\+973\d{8}$/.test(phone) ? phone : null
}

function smsConfiguration() {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID } = process.env
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_VERIFY_SERVICE_SID) return null
  return { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID }
}

async function callTwilio(path, params) {
  const config = smsConfiguration()
  if (!config) throw Object.assign(new Error('Phone verification is not configured.'), { status: 503 })
  const credentials = Buffer.from(`${config.TWILIO_ACCOUNT_SID}:${config.TWILIO_AUTH_TOKEN}`).toString('base64')
  const response = await fetch(
    `https://verify.twilio.com/v2/Services/${config.TWILIO_VERIFY_SERVICE_SID}/${path}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(params),
      signal: AbortSignal.timeout(10000)
    }
  )
  const result = await response.json()
  if (!response.ok) {
    throw Object.assign(
      new Error(result.message || 'Phone verification could not be completed.'),
      { status: response.status === 429 ? 429 : 502 }
    )
  }
  return result
}

router.post('/phone/send-code', async (req, res) => {
  const phone = normalizeBahrainPhone(req.body.phoneNumber)
  if (!phone) return res.status(400).json({ err: 'Enter a valid Bahrain number in +973XXXXXXXX format.' })
  try {
    const result = await callTwilio('Verifications', { To: phone, Channel: 'sms' })
    res.json({ status: result.status, message: 'A verification code has been sent.' })
  } catch (err) {
    res.status(err.status || 502).json({ err: err.message })
  }
})

router.post('/phone/verify-code', async (req, res) => {
  const phone = normalizeBahrainPhone(req.body.phoneNumber)
  const code = String(req.body.code || '').trim()
  if (!phone || !/^\d{4,10}$/.test(code)) {
    return res.status(400).json({ err: 'Enter your Bahrain phone number and the code from the SMS.' })
  }
  try {
    const result = await callTwilio('VerificationCheck', { To: phone, Code: code })
    if (result.status !== 'approved') return res.status(400).json({ err: 'That verification code is incorrect or expired.' })

    if (req.headers.authorization) {
      const token = req.headers.authorization.split(' ')[1]
      const userId = jwt.verify(token, process.env.JWT_SECRET)?.payload?._id
      const existing = await User.findOne({ phoneNumber: phone, _id: { $ne: userId } })
      if (existing) return res.status(409).json({ err: 'That phone number is already linked to another account.' })
      const user = await User.findByIdAndUpdate(
        userId,
        { phoneNumber: phone, phoneVerifiedAt: new Date() },
        { new: true }
      ).select('-hashedPassword -phoneNumber')
      if (!user) return res.status(404).json({ err: 'Account not found.' })
      return res.json({ verified: true, user, token: createUserToken(user) })
    }

    const phoneProof = jwt.sign(
      { phoneNumber: phone, purpose: 'signup-phone-verification' },
      process.env.JWT_SECRET,
      { expiresIn: '10m', jwtid: require('crypto').randomUUID() }
    )
    res.json({ verified: true, phoneProof })
  } catch (err) {
    res.status(err.status || 400).json({ err: err.status ? err.message : 'Could not verify this code.' })
  }
})

router.post('/sign-up', async (req, res) => {
  try {
    const { username, password, neighborhood, customNeighborhood, adultConfirmed, phoneProof } = req.body
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
    if (!phoneProof) return res.status(400).json({ err: 'Verify your phone number before creating an account.' })

    let proof
    try {
      proof = jwt.verify(phoneProof, process.env.JWT_SECRET)
    } catch {
      return res.status(400).json({ err: 'Phone verification expired. Request a new code.' })
    }
    if (proof.purpose !== 'signup-phone-verification' || !normalizeBahrainPhone(proof.phoneNumber)) {
      return res.status(400).json({ err: 'Phone verification is invalid. Request a new code.' })
    }
    if (await User.findOne({ $or: [{ username: trimmedUsername }, { phoneNumber: proof.phoneNumber }] })) {
      return res.status(409).json({ err: 'Username or phone number already belongs to an account.' })
    }

    const createdUser = await User.create({
      username: trimmedUsername,
      phoneNumber: proof.phoneNumber,
      phoneVerifiedAt: new Date(),
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
    if (err.code === 11000) return res.status(409).json({ err: 'Username or phone number already belongs to an account.' })
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
