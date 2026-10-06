const dotenv = require('dotenv')
dotenv.config()
const express = require('express')
const path = require('path')
const mongoose = require('mongoose')
const cors = require('cors')
const logger = require('morgan')
const { rateLimit } = require('express-rate-limit')
const authRouter = require('./controllers/auth.routes')
const itemsRouter = require('./controllers/items.routes')
const swapsRouter = require('./controllers/swaps.routes')
const usersRouter = require('./controllers/users.routes')
const uploadRouter = require('./controllers/upload.routes')
const policyRouter = require('./controllers/policy.routes')

const app = express()
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1)
}

const allowedOrigins = (process.env.CLIENT_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
    return callback(new Error('Origin is not allowed.'))
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
app.use(express.json({ limit: '1mb' }))
app.use(logger('dev'))
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders(response) {
    response.setHeader('X-Content-Type-Options', 'nosniff')
  }
}))

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-8',
  legacyHeaders: false
})
app.use('/auth/phone/send-code', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 4,
  standardHeaders: 'draft-8',
  legacyHeaders: false
}))
app.use('/auth/phone/verify-code', authLimiter)
app.use('/auth/sign-in', authLimiter)
app.use('/auth/sign-up', rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false
}))
app.use('/upload', rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false
}))

app.use('/auth', authRouter)
app.use('/items', itemsRouter)
app.use('/swaps', swapsRouter)
app.use('/users', usersRouter)
app.use('/upload', uploadRouter)
app.use('/policy', policyRouter)

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err)
  if (err.name === 'MulterError') {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400
    const message = status === 413 ? 'Image must be 8 MB or smaller.' : 'Image upload was rejected.'
    return res.status(status).json({ err: message })
  }
  if (err.message === 'Only image files are allowed') {
    return res.status(415).json({ err: err.message })
  }
  if (err.message === 'Origin is not allowed.') {
    return res.status(403).json({ err: err.message })
  }
  console.error('Unhandled request error:', err)
  return res.status(500).json({ err: 'An unexpected server error occurred.' })
})

async function start() {
  if (!process.env.MONGODB_URI || !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('MONGODB_URI and a JWT_SECRET of at least 32 characters are required.')
  }
  if (process.env.NODE_ENV === 'production') {
    let publicApiUrl
    try {
      publicApiUrl = new URL(process.env.PUBLIC_API_URL)
    } catch {
      throw new Error('PUBLIC_API_URL must be set to the public HTTPS API origin in production.')
    }
    if (publicApiUrl.protocol !== 'https:' || publicApiUrl.pathname !== '/' ||
        publicApiUrl.search || publicApiUrl.hash) {
      throw new Error('PUBLIC_API_URL must be a HTTPS origin without a path, query, or fragment.')
    }
  }
  await mongoose.connect(process.env.MONGODB_URI)
  console.log(`Connected to MongoDB ${mongoose.connection.name}.`)
  const port = Number(process.env.PORT) || 3000
  app.listen(port, () => console.log(`API listening on port ${port}.`))
}

start().catch(err => {
  console.error('API startup failed:', err.message)
  process.exit(1)
})
