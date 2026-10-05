const test = require('node:test')
const assert = require('node:assert/strict')
const { BANDS, getCreditBand, isCreditPriceAllowed } = require('../config/credit-policy')
const Item = require('../models/Item')
const isValidBahrainCoordinates = require('../utils/bahrain-coordinates')
const isValidImageUrl = require('../utils/valid-image-url')
const hasImageSignature = require('../utils/image-signature')
const toPublicItem = require('../utils/public-item')
const isDemoItem = require('../utils/is-demo-item')
const { hasCreditReservation } = require('../controllers/swap-helpers')

test('every listing category maps to a valid credit band for each condition', () => {
  for (const category of ['tops', 'bottoms', 'dresses', 'outerwear', 'footwear', 'accessories', 'kids', 'other']) {
    for (const condition of ['fair', 'good', 'like-new', 'new']) {
      const band = getCreditBand(category, condition)
      assert.ok(Array.isArray(band), `${category}/${condition} should have a band`)
      assert.ok(Number.isInteger(band[0]) && Number.isInteger(band[1]) && band[0] <= band[1])
    }
  }
  assert.equal(getCreditBand('unknown', 'new'), null)
})

test('credit prices must be whole numbers inside the inclusive policy band', () => {
  const band = BANDS.apparel.good
  assert.equal(isCreditPriceAllowed('tops', 'good', band[0]), true)
  assert.equal(isCreditPriceAllowed('tops', 'good', band[1]), true)
  assert.equal(isCreditPriceAllowed('tops', 'good', band[0] - 1), false)
  assert.equal(isCreditPriceAllowed('tops', 'good', band[1] + 1), false)
  assert.equal(isCreditPriceAllowed('tops', 'good', band[0] + 0.5), false)
  assert.equal(isCreditPriceAllowed('invalid', 'good', band[0]), false)
})

test('legacy swap credit reservations preserve recorded zero and fractional amounts', () => {
  assert.equal(hasCreditReservation({ creditsSpentByRequester: 0 }), true)
  assert.equal(hasCreditReservation({ creditsSpentByRequester: 12.5 }), true)
  assert.equal(hasCreditReservation({ creditsSpentByRequester: undefined }), false)
  assert.equal(hasCreditReservation({ creditsSpentByRequester: -1 }), false)
  assert.equal(hasCreditReservation({ creditsSpentByRequester: 51 }), false)
  assert.equal(hasCreditReservation({ creditsSpentByRequester: Number.NaN }), false)
})

test('pickup details and demo flags are first-class item fields', () => {
  assert.ok(Item.schema.path('pickupLocation.address'))
  assert.ok(Item.schema.path('pickupLocation.coordinates'))
  assert.ok(Item.schema.path('isDemo'))
  assert.equal(Item.schema.path('location.pickupLocation'), undefined)
})

test('public item serialization removes current and legacy private pickup fields', () => {
  const item = Item.hydrate({
    _id: '000000000000000000000002',
    isDemo: false,
    location: {
      type: 'Point',
      coordinates: [50.58, 26.21],
      neighborhood: 'Manama',
      pickupLocation: { address: 'legacy private address', coordinates: [50.58, 26.21] },
      isDemo: true
    },
    pickupLocation: { type: 'private', address: 'current private address', coordinates: [50.58, 26.21] }
  })
  const result = toPublicItem(item)
  assert.equal(result.pickupLocation, undefined)
  assert.equal(result.location.pickupLocation, undefined)
  assert.equal(result.location.isDemo, undefined)
  assert.equal(result.isDemo, true)
  assert.equal(isDemoItem(item), true)
})

test('pickup pins must be valid coordinates within Bahrain', () => {
  assert.equal(isValidBahrainCoordinates([50.586, 26.215]), true)
  assert.equal(isValidBahrainCoordinates(['50.586', '26.215']), true)
  assert.equal(isValidBahrainCoordinates([0, 0]), false)
  assert.equal(isValidBahrainCoordinates([50.586, Number.NaN]), false)
  assert.equal(isValidBahrainCoordinates([50.586]), false)
})

test('listing photos must be hosted by this API and served over HTTPS in production', () => {
  const apiOrigin = 'https://api.rewear.example'
  assert.equal(isValidImageUrl(`${apiOrigin}/uploads/item.jpg`, apiOrigin, true), true)
  assert.equal(isValidImageUrl('https://images.example/item.jpg', apiOrigin, true), false)
  assert.equal(isValidImageUrl(`${apiOrigin}/uploads/item.jpg`, apiOrigin, false), true)
  assert.equal(isValidImageUrl('http://localhost:3000/uploads/item.jpg', 'http://localhost:3000', false), true)
  assert.equal(isValidImageUrl('http://localhost:3000/uploads/item.jpg', 'http://localhost:3000', true), false)
  assert.equal(isValidImageUrl('https://api.rewear.example/profile/item.jpg', apiOrigin, true), false)
  assert.equal(isValidImageUrl(`${apiOrigin}/uploads/item.jpg?token=secret`, apiOrigin, true), false)
})

test('uploaded image content must match its declared supported format', () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00])
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const webp = Buffer.from('RIFF0000WEBP')
  assert.equal(hasImageSignature(jpeg, 'image/jpeg'), true)
  assert.equal(hasImageSignature(png, 'image/png'), true)
  assert.equal(hasImageSignature(webp, 'image/webp'), true)
  assert.equal(hasImageSignature(Buffer.from('<svg/>'), 'image/png'), false)
  assert.equal(hasImageSignature(jpeg, 'image/png'), false)
})
