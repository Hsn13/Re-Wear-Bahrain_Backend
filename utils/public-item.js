const isDemoItem = require('./is-demo-item')

module.exports = function toPublicItem(item) {
  const result = item.toObject()
  delete result.pickupLocation
  if (result.location) {
    delete result.location.pickupLocation
    delete result.location.isDemo
  }
  if (isDemoItem(item)) result.isDemo = true
  return result
}
