const jwt = require('jsonwebtoken')

module.exports = function createUserToken(user) {
  return jwt.sign({
    payload: {
      _id: user._id,
      username: user.username,
      ecoCredits: user.ecoCredits,
      badges: user.badges,
      adultConfirmedAt: user.adultConfirmedAt
    }
  }, process.env.JWT_SECRET, { expiresIn: '24h' })
}
