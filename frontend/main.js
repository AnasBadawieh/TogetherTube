// frontend/main.js
const socket = io();
let player;
let currentVideoId = null;
let isPlayerReady = false;
let lastKnownTime = 0;
let prevTime = 0; // to detect large seeks

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
            'onError': (e) => console.error('YT error:', e)
        }
    });
}

function onPlayerReady(event) {
    isPlayerReady = true;
    fetchInitialVideoState();
}

function onPlayerStateChange(event) {
    if (!isPlayerReady || !currentVideoId) return;
    const currentTime = player.getCurrentTime();
    if (event.data === YT.PlayerState.PLAYING) {
        // If user pressed Play, tell server
        socket.emit('playVideo', { videoId: currentVideoId, startTime: currentTime });
    } else if (event.data === YT.PlayerState.PAUSED) {
        // If user pressed Pause, tell server
        socket.emit('pauseVideo');
    }
    // Detect large seek
    if (Math.abs(currentTime - prevTime) > 1) {
        socket.emit('seekVideo', { newTime: currentTime });
    }
    prevTime = currentTime;
}

// Retry mechanism to load video
function loadVideoWithRetry(videoId, startTime, attempts = 20) {
    if (attempts <= 0) {
        console.error('Failed to load video after multiple attempts');
        return;
    }
    if (isPlayerReady) {
        player.loadVideoById(videoId, startTime);
    } else {
        setTimeout(() => loadVideoWithRetry(videoId, startTime, attempts - 1), 2000);
    }
}

// Fetch initial video state from the database
function fetchInitialVideoState() {
    socket.emit('requestInitialState');
}

// Listen for server events
socket.on('initState', (data) => {
    currentVideoId = data.videoId;
    if (data.videoId) {
        loadVideoWithRetry(data.videoId, data.currentTime);
        if (data.isPlaying) {
            // Calculate offset
            const elapsed = (Date.now() - data.serverWallClock) / 1000;
            if (isPlayerReady) {
                player.seekTo(data.currentTime + elapsed);
                player.playVideo();
            }
        } else {
            if (isPlayerReady) {
                player.seekTo(data.currentTime);
                player.pauseVideo();
            }
        }
    }
});

socket.on('playEvent', (data) => {
    if (currentVideoId !== data.videoId) {
        currentVideoId = data.videoId;
        const elapsed = (Date.now() - data.serverWallClock) / 1000;
        loadVideoWithRetry(data.videoId, data.startTime + elapsed);
    }
    if (data.isPlaying && isPlayerReady) {
        player.playVideo();
    }
});

socket.on('pauseEvent', (data) => {
    currentVideoId = data.videoId;
    if (isPlayerReady) {
        player.seekTo(data.lastKnownTime, true);
        player.pauseVideo();
    }
});

socket.on('seekEvent', (data) => {
    currentVideoId = data.videoId;
    if (isPlayerReady) {
        // If playing, we have serverWallClock
        if (data.serverWallClock) {
            const elapsed = (Date.now() - data.serverWallClock) / 1000;
            player.seekTo(data.newTime + elapsed, true);
        } else {
            // If paused
            player.seekTo(data.newTime, true);
        }
    }
});

// Simple loadVideo button
document.getElementById('loadVideo').addEventListener('click', () => {
    const url = document.getElementById('videoUrl').value;
    const videoId = extractYouTubeId(url);
    if (videoId) {
        currentVideoId = videoId;
        loadVideoWithRetry(videoId, 0);
        socket.emit('playVideo', { videoId, startTime: 0 });
    }
});

// Minimal ID extraction
function extractYouTubeId(url) {
    try {
        const parsed = new URL(url);
        return parsed.searchParams.get('v') || parsed.pathname.replace('/', '');
    } catch { return null; }
}