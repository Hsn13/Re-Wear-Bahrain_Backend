const jwt = require('jsonwebtoken')
const User = require('../models/User')

async function verifyToken(req, res, next) {
  try {
    const authorization = req.headers.authorization || ''
    if (!authorization.startsWith('Bearer ')) {
      return res.status(401).json({ err: 'Authentication required.' })
    }
    const decoded = jwt.verify(authorization.slice(7), process.env.JWT_SECRET)
    const user = await User.findById(decoded.payload?._id)
      .select('_id username ecoCredits badges adultConfirmedAt isDemo')
    if (!user || user.isDemo) {
      return res.status(401).json({ err: 'Account is not authorized to use this service.' })
    }
    req.user = user
    return next()
  } catch (err) {
    if (['JsonWebTokenError', 'TokenExpiredError'].includes(err.name)) {
      return res.status(401).json({ err: 'Your session is invalid or expired. Please sign in again.' })
    }
    return res.status(500).json({ err: 'Could not verify your session.' })
  }
}

module.exports = verifyToken
