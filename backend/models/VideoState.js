const mongoose = require('mongoose');

const videoStateSchema = new mongoose.Schema({
    videoId: String,
    currentTime: Number
});

module.exports = mongoose.model('VideoState', videoStateSchema);