const router = require('express').Router()
const multer = require('multer')
const path   = require('path')
const fs     = require('fs')
const verifyToken = require('../middleware/verify-token')
const crypto = require('crypto')
const hasImageSignature = require('../utils/image-signature')

const uploadsDir = path.join(__dirname, '..', 'uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir)

const IMAGE_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${IMAGE_EXTENSIONS[file.mimetype]}`)
})

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true)
    else cb(new Error('Only image files are allowed'))
  }
})

router.post('/', verifyToken, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ err: 'No file uploaded' })
  const handle = await fs.promises.open(req.file.path, 'r')
  let signature
  try {
    const header = Buffer.alloc(12)
    const { bytesRead } = await handle.read(header, 0, header.length, 0)
    signature = hasImageSignature(header.subarray(0, bytesRead), req.file.mimetype)
  } finally {
    await handle.close()
  }
  if (!signature) {
    await fs.promises.unlink(req.file.path)
    return res.status(415).json({ err: 'The uploaded file content does not match a supported image format.' })
  }
  const publicUrl = process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`
  const url = `${publicUrl.replace(/\/$/, '')}/uploads/${req.file.filename}`
  res.json({ url })
})

module.exports = router
