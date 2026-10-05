module.exports = function approximateCoordinates(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return coordinates
  return coordinates.map(value => Math.round(Number(value) * 100) / 100)
}
