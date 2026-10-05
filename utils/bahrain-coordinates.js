module.exports = function isValidBahrainCoordinates(value) {
  if (!Array.isArray(value) || value.length !== 2) return false
  const [longitude, latitude] = value.map(Number)
  return Number.isFinite(longitude) && Number.isFinite(latitude) &&
    longitude >= 50.2 && longitude <= 50.9 && latitude >= 25.5 && latitude <= 26.5
}
