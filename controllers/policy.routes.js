const router = require('express').Router()
const { BANDS } = require('../config/credit-policy')

router.get('/credits', (req, res) => {
  res.json({
    bands: BANDS,
    categoryGroups: {
      tops: 'apparel',
      bottoms: 'apparel',
      dresses: 'apparel',
      outerwear: 'apparel',
      footwear: 'footwear',
      accessories: 'accessories',
      kids: 'kids',
      other: 'other'
    },
    maxPhotos: 5,
    minPhotos: 1,
    minDescriptionLength: 20,
    currency: 'Eco-Credits',
    monetaryValue: false
  })
})

module.exports = router
