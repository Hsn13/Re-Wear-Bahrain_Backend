const crypto = require('crypto')
const router = require('express').Router()
const mongoose = require('mongoose')
const Swap = require('../models/Swap')
const Item = require('../models/Item')
const User = require('../models/User')
const verifyToken = require('../middleware/verify-token')
const isValidBahrainCoordinates = require('../utils/bahrain-coordinates')
const isDemoItem = require('../utils/is-demo-item')
const {
  ACTIVE_STATUSES,
  SWAP_POPULATE,
  createHandoverCode,
  hashHandoverCode,
  hasCreditReservation,
  isModerator,
  loadSwap,
  settleSwap
} = require('./swap-helpers')

const isParticipant = (swap, userId) =>
  [swap.requester.toString(), swap.owner.toString()].includes(String(userId))

async function finishIfConfirmed(swap, session) {
  if (swap.requesterConfirmedAt && swap.ownerConfirmedAt) {
    return settleSwap(swap, session)
  }
  await swap.save({ session })
  return null
}

router.post('/', verifyToken, async (req, res) => {
  const { itemId, pickupNotes } = req.body
  if (!itemId || typeof itemId !== 'string' || !mongoose.isValidObjectId(itemId)) {
    return res.status(400).json({ err: 'A valid itemId is required.' })
  }
  if (typeof pickupNotes !== 'string' || pickupNotes.trim().length < 10 || pickupNotes.trim().length > 500) {
    return res.status(400).json({ err: 'Add a pickup message between 10 and 500 characters.' })
  }

  let session
  try {
    const requester = await User.findById(req.user._id)
    if (requester.adultConfirmedAt == null) {
      return res.status(403).json({ err: 'Confirm you are 18 or older before trading.' })
    }

    session = await mongoose.startSession()
    let createdSwap
    await session.withTransaction(async () => {
      const item = await Item.findOne({ _id: itemId, status: 'available' }).session(session)
      if (!item) throw Object.assign(new Error('Item is no longer available.'), { status: 409 })
      if (isDemoItem(item)) throw Object.assign(new Error('Demo listings cannot be claimed.'), { status: 400 })
      if (!item.pickupLocation?.address || !isValidBahrainCoordinates(item.pickupLocation.coordinates)) {
        throw Object.assign(new Error('This listing needs verified pickup details before it can be requested.'), { status: 409 })
      }
      if (item.owner.toString() === String(req.user._id)) {
        throw Object.assign(new Error('You cannot request your own item.'), { status: 400 })
      }

      const owner = await User.findById(item.owner).session(session)
      if (!owner?.adultConfirmedAt) {
        throw Object.assign(new Error('The owner is not eligible to trade yet.'), { status: 409 })
      }
      if (owner.isDemo) throw Object.assign(new Error('Demo listings cannot be claimed.'), { status: 400 })

      const activeCount = await Swap.countDocuments({
        requester: requester._id,
        status: { $in: ACTIVE_STATUSES }
      }).session(session)
      if (activeCount >= 3) {
        throw Object.assign(new Error('You can have up to three active swap requests at a time.'), { status: 429 })
      }

      const debit = await User.updateOne(
        { _id: requester._id, ecoCredits: { $gte: item.ecoCreditsPrice } },
        { $inc: { ecoCredits: -item.ecoCreditsPrice } },
        { session }
      )
      if (!debit.modifiedCount) {
        throw Object.assign(new Error('Not enough Eco-Credits to request this item.'), { status: 400 })
      }

      const reserved = await Item.updateOne(
        { _id: item._id, status: 'available' },
        { $set: { status: 'pending' } },
        { session }
      )
      if (!reserved.modifiedCount) {
        throw Object.assign(new Error('Item was just requested by someone else.'), { status: 409 })
      }

      ;[createdSwap] = await Swap.create([{
        item: item._id,
        requester: requester._id,
        owner: owner._id,
        creditsSpentByRequester: item.ecoCreditsPrice,
        pickupDetails: { notes: pickupNotes.trim() },
        messages: [{ sender: requester._id, text: pickupNotes.trim() }]
      }], { session })
    })

    const populated = await Swap.findById(createdSwap._id).populate(SWAP_POPULATE)
    res.status(201).json({ swap: populated })
  } catch (err) {
    res.status(err.status || 500).json({ err: err.status ? err.message : 'Could not create swap request.' })
  } finally {
    await session?.endSession()
  }
})

router.get('/moderation/disputes', verifyToken, async (req, res) => {
  if (!isModerator(req.user._id)) return res.status(403).json({ err: 'Moderator access required.' })
  try {
    const swaps = await Swap.find({ status: 'disputed' }).sort({ updatedAt: 1 }).populate(SWAP_POPULATE)
    res.json({ swaps })
  } catch {
    res.status(500).json({ err: 'Could not load disputes.' })
  }
})

router.get('/mine', verifyToken, async (req, res) => {
  try {
    const swaps = await Swap.find({
      $or: [{ requester: req.user._id }, { owner: req.user._id }]
    }).sort({ createdAt: -1 }).populate(SWAP_POPULATE)

    const results = await Promise.all(swaps.map(async swap => {
      const result = swap.toObject()
      if (['approved', 'disputed'].includes(swap.status)) {
        const item = await Item.findById(swap.item._id).select('pickupLocation')
        result.item.pickupLocation = item?.pickupLocation
      }
      if (result.reviews.length < 2) result.reviews = []
      return result
    }))
    res.json({ swaps: results })
  } catch {
    res.status(500).json({ err: 'Could not load your swaps.' })
  }
})

router.get('/:id/reviews', verifyToken, async (req, res) => {
  try {
    const swap = await Swap.findById(req.params.id).select('requester owner status reviews')
    if (!swap) return res.status(404).json({ err: 'Swap not found.' })
    if (!isParticipant(swap, req.user._id)) return res.status(403).json({ err: 'Not authorized.' })
    const myReview = swap.reviews.find(review => review.reviewer.toString() === String(req.user._id))
    if (swap.reviews.length < 2) {
      return res.json({ myReview: myReview || null, reviews: [], pendingMutualReview: true })
    }
    return res.json({ myReview: myReview || null, reviews: swap.reviews, pendingMutualReview: false })
  } catch {
    return res.status(500).json({ err: 'Could not load reviews.' })
  }
})

router.post('/:id/reviews', verifyToken, async (req, res) => {
  const rating = Number(req.body.rating)
  const comment = typeof req.body.comment === 'string' ? req.body.comment.trim() : ''
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length > 500) {
    return res.status(400).json({ err: 'Choose a rating from 1 to 5 and keep the note under 500 characters.' })
  }
  try {
    const swap = await Swap.findOne({
      _id: req.params.id,
      status: 'completed',
      $or: [{ requester: req.user._id }, { owner: req.user._id }]
    })
    if (!swap) return res.status(409).json({ err: 'Reviews are available after a completed swap.' })
    if (swap.reviews.some(review => review.reviewer.toString() === String(req.user._id))) {
      return res.status(409).json({ err: 'You have already reviewed this swap.' })
    }
    const recipient = swap.requester.toString() === String(req.user._id) ? swap.owner : swap.requester
    swap.reviews.push({ reviewer: req.user._id, recipient, rating, comment })
    await swap.save()
    const reviews = swap.reviews.length === 2 ? swap.reviews : []
    return res.status(201).json({ myReview: swap.reviews[swap.reviews.length - 1], reviews, pendingMutualReview: swap.reviews.length < 2 })
  } catch {
    return res.status(500).json({ err: 'Could not submit review.' })
  }
})

router.get('/:id/messages', verifyToken, async (req, res) => {
  try {
    const swap = await Swap.findById(req.params.id).select('requester owner status messages')
    if (!swap) return res.status(404).json({ err: 'Swap not found.' })
    if (!isParticipant(swap, req.user._id)) return res.status(403).json({ err: 'Not authorized.' })
    res.json({ messages: swap.messages, closed: ['completed', 'cancelled'].includes(swap.status) })
  } catch {
    res.status(500).json({ err: 'Could not load messages.' })
  }
})

router.post('/:id/messages', verifyToken, async (req, res) => {
  const text = req.body.text
  if (typeof text !== 'string' || text.trim().length < 1 || text.trim().length > 1000) {
    return res.status(400).json({ err: 'Messages must be between 1 and 1,000 characters.' })
  }
  try {
    const swap = await Swap.findOneAndUpdate(
      { _id: req.params.id, status: { $in: ['requested', 'approved', 'disputed'] }, $or: [{ requester: req.user._id }, { owner: req.user._id }] },
      { $push: { messages: { $each: [{ sender: req.user._id, text: text.trim() }], $slice: -200 } } },
      { new: true }
    )
    if (!swap) return res.status(409).json({ err: 'Conversation is not open.' })
    res.status(201).json({ message: swap.messages[swap.messages.length - 1] })
  } catch {
    res.status(500).json({ err: 'Could not send message.' })
  }
})

router.patch('/:id/approve', verifyToken, async (req, res) => {
  try {
    const owner = await User.findById(req.user._id)
    if (!owner?.adultConfirmedAt) {
      return res.status(403).json({ err: 'Confirm you are 18 or older before approving swaps.' })
    }
    const pendingSwap = await Swap.findOne({
      _id: req.params.id,
      owner: req.user._id,
      status: 'requested'
    }).select('item creditsSpentByRequester')
    if (!pendingSwap) return res.status(409).json({ err: 'Swap is no longer awaiting approval.' })
    if (!hasCreditReservation(pendingSwap)) {
      return res.status(409).json({ err: 'This legacy swap needs a verified credit ledger before approval.' })
    }
    const pendingItem = await Item.findOne({ _id: pendingSwap.item, status: 'pending' }).select('pickupLocation')
    if (!pendingItem?.pickupLocation?.address ||
        !isValidBahrainCoordinates(pendingItem.pickupLocation.coordinates)) {
      return res.status(409).json({ err: 'This listing needs verified pickup details before approval.' })
    }
    const code = createHandoverCode()
    const swap = await Swap.findOneAndUpdate(
      {
        _id: req.params.id,
        owner: req.user._id,
        status: 'requested',
        creditsSpentByRequester: pendingSwap.creditsSpentByRequester
      },
      {
        $set: {
          status: 'approved',
          handoverCodeHash: hashHandoverCode(code),
          handoverCodeExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
          handoverCodeAttempts: 0
        }
      },
      { new: true }
    )
    if (!swap) return res.status(409).json({ err: 'Swap is no longer awaiting approval.' })
    const result = await loadSwap(swap._id, req.user._id)
    res.json({ swap: result, handoverCode: code })
  } catch {
    res.status(500).json({ err: 'Could not approve swap.' })
  }
})

router.post('/:id/refresh-handover-code', verifyToken, async (req, res) => {
  try {
    const currentSwap = await Swap.findOne({
      _id: req.params.id,
      owner: req.user._id,
      status: 'approved'
    }).select('creditsSpentByRequester')
    if (!currentSwap || !hasCreditReservation(currentSwap)) {
      return res.status(409).json({ err: 'This swap needs a verified credit ledger before pickup can continue.' })
    }
    const code = createHandoverCode()
    const swap = await Swap.findOneAndUpdate(
      {
        _id: req.params.id,
        owner: req.user._id,
        status: 'approved',
        creditsSpentByRequester: currentSwap.creditsSpentByRequester
      },
      {
        $set: {
          handoverCodeHash: hashHandoverCode(code),
          handoverCodeExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
          handoverCodeAttempts: 0
        }
      },
      { new: true }
    )
    if (!swap) return res.status(409).json({ err: 'This swap is not awaiting pickup.' })
    res.json({ handoverCode: code })
  } catch {
    res.status(500).json({ err: 'Could not create a new handover code.' })
  }
})

router.post('/:id/confirm-handover', verifyToken, async (req, res) => {
  const code = String(req.body.code || '')
  if (!/^\d{8}$/.test(code)) return res.status(400).json({ err: 'Enter the 8-digit handover code.' })
  const session = await mongoose.startSession()
  try {
    let completion
    let invalidCode = false
    await session.withTransaction(async () => {
      const swap = await Swap.findOne({
        _id: req.params.id,
        requester: req.user._id,
        status: 'approved'
      }).select('+handoverCodeHash').session(session)
      if (!swap) throw Object.assign(new Error('Swap is not awaiting your confirmation.'), { status: 409 })
      if (!hasCreditReservation(swap)) {
        throw Object.assign(new Error('This legacy swap needs a verified credit ledger before confirmation.'), { status: 409 })
      }
      if (swap.handoverCodeExpiresAt < new Date() || swap.handoverCodeAttempts >= 5) {
        throw Object.assign(new Error('Handover code expired or locked. Ask the owner to create a new one.'), { status: 410 })
      }
      const expected = Buffer.from(swap.handoverCodeHash || '', 'hex')
      const provided = Buffer.from(hashHandoverCode(code), 'hex')
      if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
        swap.handoverCodeAttempts += 1
        await swap.save({ session })
        invalidCode = true
        return
      }
      if (!swap.requesterConfirmedAt) swap.requesterConfirmedAt = new Date()
      completion = await finishIfConfirmed(swap, session)
    })
    if (invalidCode) return res.status(400).json({ err: 'That handover code is incorrect.' })
    const result = await loadSwap(req.params.id, req.user._id)
    res.json({ swap: result, completed: result.status === 'completed', badgesUnlocked: completion?.newBadges || [] })
  } catch (err) {
    res.status(err.status || 500).json({ err: err.status ? err.message : 'Could not confirm handover.' })
  } finally {
    await session.endSession()
  }
})

router.post('/:id/confirm-owner', verifyToken, async (req, res) => {
  const session = await mongoose.startSession()
  try {
    let completion
    await session.withTransaction(async () => {
      const swap = await Swap.findOne({
        _id: req.params.id,
        owner: req.user._id,
        status: 'approved'
      }).session(session)
      if (!swap) throw Object.assign(new Error('Swap is not awaiting your confirmation.'), { status: 409 })
      if (!hasCreditReservation(swap)) {
        throw Object.assign(new Error('This legacy swap needs a verified credit ledger before confirmation.'), { status: 409 })
      }
      if (!swap.requesterConfirmedAt) {
        throw Object.assign(new Error('The requester must confirm the handover code first.'), { status: 409 })
      }
      if (!swap.ownerConfirmedAt) swap.ownerConfirmedAt = new Date()
      completion = await finishIfConfirmed(swap, session)
    })
    const result = await loadSwap(req.params.id, req.user._id)
    res.json({ swap: result, completed: result.status === 'completed', badgesUnlocked: completion?.newBadges || [] })
  } catch (err) {
    res.status(err.status || 500).json({ err: err.status ? err.message : 'Could not confirm handover.' })
  } finally {
    await session.endSession()
  }
})

router.post('/:id/dispute', verifyToken, async (req, res) => {
  const reason = String(req.body.reason || '').trim()
  if (reason.length < 10 || reason.length > 1000) {
    return res.status(400).json({ err: 'Explain the issue in 10–1,000 characters.' })
  }
  try {
    const currentSwap = await Swap.findOne({
      _id: req.params.id,
      status: 'approved',
      $or: [{ requester: req.user._id }, { owner: req.user._id }]
    }).select('creditsSpentByRequester')
    if (!currentSwap) return res.status(409).json({ err: 'This swap cannot be disputed now.' })
    if (!hasCreditReservation(currentSwap)) {
      return res.status(409).json({ err: 'This legacy swap needs a verified credit ledger before dispute review.' })
    }
    const swap = await Swap.findOneAndUpdate(
      {
        _id: req.params.id,
        status: 'approved',
        creditsSpentByRequester: currentSwap.creditsSpentByRequester,
        $or: [{ requester: req.user._id }, { owner: req.user._id }]
      },
      { $set: { status: 'disputed', disputedBy: req.user._id, disputeReason: reason } },
      { new: true }
    )
    if (!swap) return res.status(409).json({ err: 'This swap cannot be disputed now.' })
    res.json({ swap })
  } catch {
    res.status(500).json({ err: 'Could not report this swap.' })
  }
})

router.post('/:id/cancel', verifyToken, async (req, res) => {
  const session = await mongoose.startSession()
  try {
    await session.withTransaction(async () => {
      const swap = await Swap.findOne({
        _id: req.params.id,
        status: 'requested',
        $or: [{ requester: req.user._id }, { owner: req.user._id }]
      }).session(session)
      if (!swap) throw Object.assign(new Error('Only a request that has not been approved can be cancelled. Report an approved swap problem for moderator review.'), { status: 409 })
      if (!hasCreditReservation(swap)) {
        throw Object.assign(new Error('This legacy swap needs a verified credit ledger before cancellation.'), { status: 409 })
      }
      const isOwner = swap.owner.toString() === String(req.user._id)
      const reason = String(req.body.reason || '').trim()
      swap.status = 'cancelled'
      swap.cancelledBy = isOwner ? 'owner' : 'requester'
      if (isOwner && reason) swap.cancelReason = reason.slice(0, 300)
      await swap.save({ session })
      await User.updateOne(
        { _id: swap.requester },
        { $inc: { ecoCredits: swap.creditsSpentByRequester } },
        { session }
      )
      const releasedItem = await Item.updateOne(
        { _id: swap.item, status: 'pending' },
        { $set: { status: 'available' } },
        { session }
      )
      if (!releasedItem.modifiedCount) throw new Error('The listing is no longer pending this swap.')
    })
    res.json({ swap: await loadSwap(req.params.id, req.user._id) })
  } catch (err) {
    res.status(err.status || 500).json({ err: err.status ? err.message : 'Could not cancel swap.' })
  } finally {
    await session.endSession()
  }
})

router.post('/moderation/disputes/:id/resolve', verifyToken, async (req, res) => {
  if (!isModerator(req.user._id)) return res.status(403).json({ err: 'Moderator access required.' })
  const { action } = req.body
  const note = String(req.body.note || '').trim()
  if (!['refund', 'complete'].includes(action) || note.length < 10 || note.length > 1000) {
    return res.status(400).json({ err: 'Choose refund or complete and add a resolution note (10–1,000 characters).' })
  }
  const session = await mongoose.startSession()
  try {
    let credits
    await session.withTransaction(async () => {
      const swap = await Swap.findOne({ _id: req.params.id, status: 'disputed' }).session(session)
      if (!swap) throw Object.assign(new Error('Dispute is already resolved or does not exist.'), { status: 409 })
      if (!hasCreditReservation(swap)) {
        throw Object.assign(new Error('This legacy swap needs a verified credit ledger before resolution.'), { status: 409 })
      }
      swap.disputeResolution = { action, note, moderatorId: req.user._id, resolvedAt: new Date() }
      if (action === 'refund') {
        swap.status = 'cancelled'
        swap.cancelledBy = 'owner'
        await User.updateOne(
          { _id: swap.requester },
          { $inc: { ecoCredits: swap.creditsSpentByRequester } },
          { session }
        )
        await Item.updateOne({ _id: swap.item }, { $set: { status: 'available' } }, { session })
      } else {
        const result = await settleSwap(swap, session)
        credits = result.owner.ecoCredits
      }
      await swap.save({ session })
    })
    const swap = await Swap.findById(req.params.id).populate(SWAP_POPULATE)
    res.json({ swap, ownerEcoCredits: credits })
  } catch (err) {
    res.status(err.status || 500).json({ err: err.status ? err.message : 'Could not resolve dispute.' })
  } finally {
    await session.endSession()
  }
})

module.exports = router
