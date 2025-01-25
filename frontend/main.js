// frontend/main.js
const socket = io();
const LATENCY_THRESHOLD = 1.5; // Allowable latency in seconds

let player;
let currentVideoId = null;
let isPlayerReady = false;
let lastKnownTime = 0;
let prevTime = 0; // to detect large seeks
let debounceSeek = false;
let isRemoteUpdate = false;

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

    // If this state change is coming from a remote command,
    // do NOT emit anything back to the server
    if (isRemoteUpdate) {
        isRemoteUpdate = false; // reset for next time
        return;
    }

    // Otherwise, it's a local user action (user pressed play/pause or scrubbed)
    const currentTime = player.getCurrentTime();
    if (event.data === YT.PlayerState.PLAYING) {
        socket.emit('playVideo', { videoId: currentVideoId, startTime: currentTime });
    } else if (event.data === YT.PlayerState.PAUSED) {
        socket.emit('pauseVideo');
    }

    // If user scrubs significantly
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
    console.log('Received initState:', data); // Log the initState data
    currentVideoId = data.videoId;
    if (data.videoId) {
        loadVideoWithRetry(data.videoId, data.currentTime);
        if (isPlayerReady) {
            player.seekTo(data.currentTime);
            if (data.isPlaying) {
                player.playVideo();
            } else {
                player.pauseVideo();
            }
        } else {
            const checkPlayerReady = setInterval(() => {
                if (isPlayerReady) {
                    player.seekTo(data.currentTime);
                    if (data.isPlaying) {
                        player.playVideo();
                    } else {
                        player.pauseVideo();
                    }
                    clearInterval(checkPlayerReady);
                }
            }, 100);
        }
    }
});

socket.on('playEvent', (data) => {
    if (currentVideoId !== data.videoId) {
        currentVideoId = data.videoId;
        const elapsed = (Date.now() - data.serverWallClock) / 1000;
        loadVideoWithRetry(data.videoId, data.startTime + elapsed);
    }
    if (isPlayerReady) {
        const elapsed = (Date.now() - data.serverWallClock) / 1000;
        isRemoteUpdate = true;
        player.seekTo(data.startTime + elapsed);
        player.playVideo();
    } else {
        const checkPlayerReady = setInterval(() => {
            if (isPlayerReady) {
                const elapsed = (Date.now() - data.serverWallClock) / 1000;
                isRemoteUpdate = true;
                player.seekTo(data.startTime + elapsed);
                player.playVideo();
                clearInterval(checkPlayerReady);
            }
        }, 100);
    }
});

socket.on('pauseEvent', (data) => {
    currentVideoId = data.videoId;
    if (isPlayerReady) {
        isRemoteUpdate = true;
        player.seekTo(data.lastKnownTime, true);
        player.pauseVideo();
    } else {
        const checkPlayerReady = setInterval(() => {
            if (isPlayerReady) {
                isRemoteUpdate = true;
                player.seekTo(data.lastKnownTime, true);
                player.pauseVideo();
                clearInterval(checkPlayerReady);
            }
        }, 100);
    }
});

socket.on('seekEvent', (data) => {
    currentVideoId = data.videoId;
    if (isPlayerReady) {
        // If playing, we have serverWallClock
        if (data.serverWallClock) {
            const elapsed = (Date.now() - data.serverWallClock) / 1000;
            if (Math.abs(player.getCurrentTime() - (data.newTime + elapsed)) > LATENCY_THRESHOLD) {
                isRemoteUpdate = true;
                player.seekTo(data.newTime + elapsed, true);
            }
        } else {
            // If paused
            if (Math.abs(player.getCurrentTime() - data.newTime) > LATENCY_THRESHOLD) {
                isRemoteUpdate = true;
                player.seekTo(data.newTime, true);
            }
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