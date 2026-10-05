module.exports = function isValidImageUrl(value, apiOrigin, isProduction) {
  if (typeof value !== 'string') return false
  try {
    const imageUrl = new URL(value)
    const expectedOrigin = new URL(apiOrigin).origin
    if (imageUrl.origin !== expectedOrigin || !imageUrl.pathname.startsWith('/uploads/') ||
        imageUrl.username || imageUrl.password || imageUrl.search || imageUrl.hash) return false
    if (imageUrl.protocol === 'https:') return true
    return !isProduction && imageUrl.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(imageUrl.hostname)
  } catch {
    return false
  }
}
