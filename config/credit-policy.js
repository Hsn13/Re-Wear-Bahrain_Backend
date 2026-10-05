const BANDS = {
  apparel: {
    fair: [2, 5],
    good: [5, 10],
    'like-new': [8, 15],
    new: [10, 20]
  },
  footwear: {
    fair: [2, 5],
    good: [4, 10],
    'like-new': [8, 15],
    new: [10, 20]
  },
  accessories: {
    fair: [1, 4],
    good: [3, 7],
    'like-new': [5, 10],
    new: [7, 12]
  },
  kids: {
    fair: [1, 4],
    good: [3, 8],
    'like-new': [5, 12],
    new: [7, 15]
  },
  other: {
    fair: [1, 3],
    good: [2, 6],
    'like-new': [3, 8],
    new: [5, 10]
  }
}

const CATEGORY_GROUP = {
  tops: 'apparel',
  bottoms: 'apparel',
  dresses: 'apparel',
  outerwear: 'apparel',
  footwear: 'footwear',
  accessories: 'accessories',
  kids: 'kids',
  other: 'other'
}

function getCreditBand(category, condition) {
  const group = CATEGORY_GROUP[category]
  return group ? BANDS[group]?.[condition] ?? null : null
}

function isCreditPriceAllowed(category, condition, value) {
  const band = getCreditBand(category, condition)
  const price = Number(value)
  return Boolean(band && Number.isInteger(price) && price >= band[0] && price <= band[1])
}

module.exports = { BANDS, CATEGORY_GROUP, getCreditBand, isCreditPriceAllowed }
