const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const path    = require('path');
const app = express();
const mongoose = require('mongoose');
const cors = require('cors');
const logger = require('morgan');
const authRouter   = require('./controllers/auth.routes');
const itemsRouter  = require('./controllers/items.routes');
const swapsRouter  = require('./controllers/swaps.routes');
const usersRouter  = require('./controllers/users.routes');
const uploadRouter = require('./controllers/upload.routes');
const verifyToken  = require('./middleware/verify-token');


mongoose.connect(process.env.MONGODB_URI);

mongoose.connection.on('connected', () => {
  console.log(`Connected to MongoDB ${mongoose.connection.name}.`);
});

app.use(cors());
app.use(express.json());
app.use(logger('dev'));

// Serve uploaded images as static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes go here
app.use('/auth', authRouter);
app.use('/items', itemsRouter);
app.use('/swaps', swapsRouter);
app.use('/users', usersRouter);
app.use('/upload', uploadRouter);


app.listen(3000, () => {
  console.log('The express app is ready!');
});
