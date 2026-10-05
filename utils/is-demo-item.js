module.exports = function isDemoItem(item) {
  const value = typeof item?.toObject === 'function' ? item.toObject() : item
  return value?.isDemo === true || value?.location?.isDemo === true
}
