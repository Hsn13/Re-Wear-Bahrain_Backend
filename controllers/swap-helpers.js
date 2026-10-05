const crypto = require('crypto')
const Swap = require('../models/Swap')
const Item = require('../models/Item')
const User = require('../models/User')

const ACTIVE_STATUSES = ['requested', 'approved', 'disputed']
const CLOSED_STATUSES = ['completed', 'cancelled']
const SWAP_POPULATE = [
  { path: 'item', select: 'title images category ecoCreditsPrice location.neighborhood isDemo' },
  { path: 'requester', select: 'username location.neighborhood location.customNeighborhood' },
  { path: 'owner', select: 'username location.neighborhood location.customNeighborhood' },
]

function createHandoverCode() {
  return crypto.randomInt(0, 100000000).toString().padStart(8, '0')
}

function hashHandoverCode(code) {
  return crypto.createHmac('sha256', process.env.JWT_SECRET).update(code).digest('hex')
}

function isModerator(userId) {
  const configuredIds = (process.env.MODERATOR_USER_IDS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
  return configuredIds.includes(String(userId))
}

function hasCreditReservation(swap) {
  const amount = swap.creditsSpentByRequester
  return Number.isFinite(amount) && amount >= 0 && amount <= 50
}

async function loadSwap(id, userId) {
  const swap = await Swap.findById(id).populate(SWAP_POPULATE)
  if (!swap) return null
  if (![swap.requester._id.toString(), swap.owner._id.toString()].includes(String(userId))) {
    return null
  }

  const result = swap.toObject()
  if (['approved', 'disputed'].includes(swap.status)) {
    const item = await Item.findById(swap.item._id).select('pickupLocation')
    result.item.pickupLocation = item?.pickupLocation
  }
  return result
}

async function settleSwap(swap, session) {
  if (!hasCreditReservation(swap)) {
    throw Object.assign(new Error('This legacy swap needs a verified credit ledger before settlement.'), { status: 409 })
  }
  const item = await Item.findOneAndUpdate(
    { _id: swap.item, status: 'pending' },
    { $set: { status: 'claimed' } },
    { new: true, session }
  )
  if (!item) throw new Error('The listing is no longer pending this swap')

  const owner = await User.findByIdAndUpdate(
    swap.owner,
    { $inc: { ecoCredits: swap.creditsSpentByRequester, itemsGivenCount: 1 } },
    { new: true, session }
  )
  if (!owner) throw new Error('Item owner not found')

  const newBadges = Swap.BADGE_THRESHOLDS
    .filter(threshold => owner.itemsGivenCount >= threshold.count && !owner.badges.includes(threshold.badge))
    .map(threshold => threshold.badge)
  if (newBadges.length) {
    await User.updateOne(
      { _id: owner._id },
      { $addToSet: { badges: { $each: newBadges } } },
      { session }
    )
  }

  swap.status = 'completed'
  swap.completedAt = new Date()
  swap.badgesUnlocked = newBadges
  await swap.save({ session })
  return { owner, newBadges }
}

module.exports = {
  ACTIVE_STATUSES,
  CLOSED_STATUSES,
  SWAP_POPULATE,
  createHandoverCode,
  hashHandoverCode,
  isModerator,
  hasCreditReservation,
  loadSwap,
  settleSwap
}
