// frontend/main.js
const socket = io();
let player;
let currentVideoId = null;
let isPlayerReady = false;
let lastSentTime = 0;
let playCounter = 0;
let playInterval;

function getYouTubeEmbedLink(url) {
    if (!url) {
        console.error('Invalid URL');
        return null;
    }
    const videoId = url.split('v=')[1];
    if (!videoId) {
        console.error('Invalid YouTube URL');
        return null;
    }
    const ampersandPosition = videoId.indexOf('&');
    if (ampersandPosition !== -1) {
        return videoId.substring(0, ampersandPosition);
    }
    return videoId;
}

function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '390',
        width: '640',
        videoId: '', // Start with empty video
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
            'onError': onPlayerError
        }
    });
}

function onPlayerReady(event) {
    isPlayerReady = true;
    fetchVideoState();
}

function onPlayerStateChange(event) {
    const currentTime = player.getCurrentTime();
    if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
        clearInterval(playInterval);
        socket.emit('videoState', {
            videoId: currentVideoId,
            currentTime: currentTime,
            isPlaying: false,
            type: 'pause'
        });
    } else if (event.data === YT.PlayerState.PLAYING) {
        playCounter = currentTime;
        clearInterval(playInterval); // Clear any existing interval
        playInterval = setInterval(() => playCounter++, 1000);
        console.log('Playing:', playCounter);
        socket.emit('videoState', {
            type: 'play',
            currentTime: player.getCurrentTime(),
            videoId: player.getVideoData().video_id,
            isPlaying: true
        });
    }
}

// Function to send changed time to the backend
function sendChangedTime(currentTime) {
    socket.emit('timeChange', {
        videoId: currentVideoId,
        currentTime: currentTime
    });
}

// Listen for playback time changes
function onPlaybackTimeChange() {
    if (player && typeof player.getCurrentTime === 'function') {
        const currentTime = player.getCurrentTime();
        if (Math.abs(currentTime - playCounter) > 2 || currentTime < playCounter) { // Detect significant change
            playCounter = currentTime;
            sendChangedTime(currentTime);
        }
    }
}

// Add event listener for playback time change
setInterval(onPlaybackTimeChange, 1000); // Check every second

function onPlayerError(event) {
    console.error('Error occurred:', event);
}

function saveVideoState(videoId, currentTime, isPlaying) {
    fetch('/api/videoState', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ videoId, currentTime, isPlaying })
    });
}

function isPlayerLoaded() {
    return player && typeof player.loadVideoById === 'function';
}

function fetchVideoState(Try = 20) {
    if (isPlayerLoaded()) {
        fetch('/api/videoState')
            .then(response => response.json())
            .then(data => {
                if (data && data.videoId) {
                    currentVideoId = data.videoId;
                    player.loadVideoById(data.videoId, data.currentTime);
                    playCounter = data.currentTime; // Start the counter from the current time
                    if (data.isPlaying) {
                        player.playVideo();
                        playInterval = setInterval(() => playCounter++, 1000); // Start the counter
                    } else {
                        player.pauseVideo();
                    }
                } else {
                    console.log('No video data found in the database.');
                }
            })
            .catch(error => {
                console.error('Error fetching video state:', error);
            });
    } else if (Try > 0) {
        setTimeout(() => fetchVideoState(Try - 1), 2000);
    } else {
        console.error('Player is not ready after multiple attempts.');
    }
}

// Listen for time change updates from the server
socket.on('timeChangeUpdate', (data) => {
    if (data.videoId === currentVideoId) {
        player.seekTo(data.currentTime);
        playCounter = data.currentTime; // Update the counter to the new time
    }
});

document.getElementById('loadVideo').addEventListener('click', () => {
    const url = document.getElementById('videoUrl').value;
    const videoId = getYouTubeEmbedLink(url);
    if (videoId) {
        currentVideoId = videoId;
        player.loadVideoById(videoId);
        saveVideoState(videoId, 0, true);
        socket.emit('update-video', { videoId, currentTime: 0, isPlaying: true });
    }
});

socket.on('video-state', (data) => {
    if (data.videoId) {
        currentVideoId = data.videoId;
        player.loadVideoById(data.videoId, data.currentTime);
        if (data.isPlaying) {
            player.playVideo();
        } else {
            player.pauseVideo();
        }
    }
});

// Socket events
socket.on('videoStateUpdate', (data) => {
    if (!isPlayerReady) return;
    
    if (data.videoId !== currentVideoId) {
        loadVideo(data.videoId, data.currentTime);
    } else {
        if (data.isPlaying) {
            player.seekTo(data.currentTime);
            player.playVideo();
        } else {
            player.pauseVideo();
        }
    }
});

// Add socket listeners for logs
socket.on('videoStateLog', (message) => {
    console.log(`[TogetherTube] ${message}`);
});