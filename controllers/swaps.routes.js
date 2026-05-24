const router = require('express').Router()
const Swap = require('../models/Swap')
const { ECO_CREDITS_EARNED_PER_GIVE, BADGE_THRESHOLDS } = Swap
const Item = require('../models/Item')
const User = require('../models/User')
const verifyToken = require('../middleware/verify-token')

const populateSwap = q =>
  q.populate('item', 'title images category ecoCreditsPrice')
   .populate('requester', 'username location')
   .populate('owner', 'username location')

// POST /swaps — requester claims an item, spending eco-credits
router.post('/', verifyToken, async (req, res) => {
  try {
    const { itemId, pickupNotes, agreedTime } = req.body

    if (!itemId) return res.status(400).json({ err: 'itemId is required' })

    const item = await Item.findById(itemId)
    if (!item) return res.status(404).json({ err: 'Item not found' })
    if (item.status !== 'available') return res.status(400).json({ err: 'Item is no longer available' })
    if (item.owner.toString() === req.user._id) {
      return res.status(400).json({ err: 'You cannot request your own item' })
    }

    const requester = await User.findById(req.user._id)
    const creditsRequired = item.ecoCreditsPrice
    if (requester.ecoCredits < creditsRequired) {
      return res.status(400).json({ err: `Not enough Eco-Credits. Need ${creditsRequired}, you have ${requester.ecoCredits}` })
    }

    await User.findByIdAndUpdate(req.user._id, { $inc: { ecoCredits: -creditsRequired } })
    await Item.findByIdAndUpdate(itemId, { status: 'pending' })

    const swap = await Swap.create({
      item: item._id,
      requester: req.user._id,
      owner: item.owner,
      creditsSpentByRequester: creditsRequired,
      creditsEarnedByOwner: ECO_CREDITS_EARNED_PER_GIVE,
      pickupDetails: { notes: pickupNotes || '', agreedTime: agreedTime || null }
    })

    const populated = await populateSwap(Swap.findById(swap._id))
    res.status(201).json({ swap: populated })
  } catch (err) {
    res.status(500).json({ err: err.message })
  }
})

// PATCH /swaps/:id/respond — owner sends a reply message to the requester
router.patch('/:id/respond', verifyToken, async (req, res) => {
  try {
    const swap = await Swap.findById(req.params.id)
    if (!swap) return res.status(404).json({ err: 'Swap not found' })
    if (swap.owner.toString() !== req.user._id) {
      return res.status(403).json({ err: 'Only the item owner can reply' })
    }
    if (['completed', 'cancelled'].includes(swap.status)) {
      return res.status(400).json({ err: 'Cannot reply to a closed swap' })
    }
    const { response } = req.body
    if (!response || !response.trim()) {
      return res.status(400).json({ err: 'Reply message cannot be empty' })
    }
    swap.ownerResponse = response.trim()
    await swap.save()
    const populated = await populateSwap(Swap.findById(swap._id))
    res.json({ swap: populated })
  } catch (err) {
    res.status(500).json({ err: err.message })
  }
})

// PATCH /swaps/:id/approve — owner approves the pickup
router.patch('/:id/approve', verifyToken, async (req, res) => {
  try {
    const swap = await Swap.findById(req.params.id)
    if (!swap) return res.status(404).json({ err: 'Swap not found' })
    if (swap.owner.toString() !== req.user._id) {
      return res.status(403).json({ err: 'Only the item owner can approve' })
    }
    if (swap.status !== 'requested') {
      return res.status(400).json({ err: `Swap is already ${swap.status}` })
    }
    swap.status = 'approved'
    await swap.save()
    const populated = await populateSwap(Swap.findById(swap._id))
    res.json({ swap: populated })
  } catch (err) {
    res.status(500).json({ err: err.message })
  }
})

// PATCH /swaps/:id/complete — owner confirms item was picked up
router.patch('/:id/complete', verifyToken, async (req, res) => {
  try {
    const swap = await Swap.findById(req.params.id)
    if (!swap) return res.status(404).json({ err: 'Swap not found' })
    if (swap.owner.toString() !== req.user._id) {
      return res.status(403).json({ err: 'Only the item owner can complete this swap' })
    }
    if (swap.status !== 'approved') {
      return res.status(400).json({ err: 'Swap must be approved first' })
    }

    const owner = await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { ecoCredits: swap.creditsEarnedByOwner, itemsGivenCount: 1 } },
      { new: true }
    )

    const newBadges = BADGE_THRESHOLDS
      .filter(t => owner.itemsGivenCount >= t.count && !owner.badges.includes(t.badge))
      .map(t => t.badge)

    if (newBadges.length > 0) {
      await User.findByIdAndUpdate(req.user._id, { $addToSet: { badges: { $each: newBadges } } })
    }

    await Item.findByIdAndUpdate(swap.item, { status: 'claimed' })
    swap.status = 'completed'
    swap.completedAt = new Date()
    swap.badgesUnlocked = newBadges
    await swap.save()

    const populated = await populateSwap(Swap.findById(swap._id))
    res.json({ swap: populated, badgesUnlocked: newBadges, newEcoCredits: owner.ecoCredits })
  } catch (err) {
    res.status(500).json({ err: err.message })
  }
})

// PATCH /swaps/:id/cancel — either party cancels; stores reason if owner cancels
router.patch('/:id/cancel', verifyToken, async (req, res) => {
  try {
    const swap = await Swap.findById(req.params.id)
    if (!swap) return res.status(404).json({ err: 'Swap not found' })

    const isRequester = swap.requester.toString() === req.user._id
    const isOwner = swap.owner.toString() === req.user._id
    if (!isRequester && !isOwner) return res.status(403).json({ err: 'Not authorized' })
    if (['completed', 'cancelled'].includes(swap.status)) {
      return res.status(400).json({ err: `Swap is already ${swap.status}` })
    }

    const { reason } = req.body

    await User.findByIdAndUpdate(swap.requester, { $inc: { ecoCredits: swap.creditsSpentByRequester } })
    await Item.findByIdAndUpdate(swap.item, { status: 'available' })

    swap.status = 'cancelled'
    swap.cancelledBy = isOwner ? 'owner' : 'requester'
    if (reason && reason.trim() && isOwner) swap.cancelReason = reason.trim()
    await swap.save()

    const populated = await populateSwap(Swap.findById(swap._id))
    res.json({ swap: populated })
  } catch (err) {
    res.status(500).json({ err: err.message })
  }
})

// GET /swaps/mine — all swaps for logged-in user (as requester or owner), including history
router.get('/mine', verifyToken, async (req, res) => {
  try {
    const swaps = await populateSwap(
      Swap.find({ $or: [{ requester: req.user._id }, { owner: req.user._id }] })
        .sort({ createdAt: -1 })
    )
    res.json({ swaps })
  } catch (err) {
    res.status(500).json({ err: err.message })
  }
})

module.exports = router
