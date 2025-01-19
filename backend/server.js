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
const bodyParser = require('body-parser');

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
app.use(bodyParser.json());

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
let previousVideoId = null;
let previousTime = null;

io.on('connection', (socket) => {
    console.log('Client connected');

    socket.on('videoState', (data) => {
        try {
            // Update video state
            videoState = { ...data };
            
            // Add logging based on type
            if (data.type === 'pause') {
                socket.broadcast.emit('videoStateLog', `Video paused at ${Math.floor(data.currentTime)}s`);
            } else if (data.type === 'play') {
                socket.broadcast.emit('videoStateLog', `Video continued at ${Math.floor(data.currentTime)}s`);
            }
            
            // Check if video changed
            if (previousVideoId && previousVideoId !== data.videoId) {
                socket.broadcast.emit('videoStateLog', `Video changed to: ${data.videoId}`);
                console.log('Video changed to:', data.videoId);
            }
            
            // Check for significant time changes (>3s difference)
            if (previousTime && Math.abs(previousTime - data.currentTime) > 3) {
                socket.broadcast.emit('videoStateLog', `Time changed to ${Math.floor(data.currentTime)}s`);
            }
            
            // Store previous states
            previousVideoId = data.videoId;
            previousTime = data.currentTime;

            // Broadcast to other clients
            socket.broadcast.emit('videoStateUpdate', videoState);
            console.log('Broadcasting videoStateUpdate:', videoState);
        } catch (error) {
            console.error('Error processing video state:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

app.post('/api/videoState', async (req, res) => {
    const { videoId, currentTime, isPlaying } = req.body;
    await VideoState.findOneAndUpdate({}, { videoId, currentTime, isPlaying }, { upsert: true });
    res.sendStatus(200);
});

app.get('/api/videoState', async (req, res) => {
    const videoState = await VideoState.findOne({});
    res.json(videoState || {});
});

server.listen(3000, () => {
  console.log('Server is running on port 3000');
});
