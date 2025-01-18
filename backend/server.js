// backend/server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const VideoState = require('./models/VideoState');
const authRoutes = require('./routes/auth');
const path = require('path');
const cookieParser = require('cookie-parser');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((err) => {
  console.error(err);
});

app.use(express.json());
app.use(cookieParser());

// Set SameSite attribute for cookies
// Remove the cookie-setting middleware if not needed
// app.use((req, res, next) => {
//   res.cookie('yourCookieName', 'yourCookieValue', { sameSite: 'Strict' });
//   next();
// });

app.use('/favicon.ico', express.static(path.join(__dirname, '../frontend/favicon.ico')));


app.use('/auth', authRoutes);

// Serve frontend
app.use(express.static(path.join(__dirname, '../frontend')));

let videoState = {};

// Sync logic
io.on('connection', (socket) => {
  console.log('A user connected');

  // Emit current video state to the newly connected user
  socket.emit('video-state', videoState);

  socket.on('update-video', (data) => {
    videoState = data;
    io.emit('video-state', videoState);
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

server.listen(3000, () => {
  console.log('Server is running on port 3000');
});
