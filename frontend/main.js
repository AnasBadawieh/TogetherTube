// frontend/main.js

// Imports and Variables
const socket = io();
const LATENCY_THRESHOLD = 1.5; 
let player;
let currentVideoId = null;
let isPlayerReady = false;
let lastKnownTime = 0;
let prevTime = 0; 
let debounceSeek = false;
let isRemoteUpdate = false;


// YouTube Link
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


// YouTube Player
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


//player state change
function onPlayerStateChange(event) {
    if (!isPlayerReady || !currentVideoId) return;
    const currentTime = player.getCurrentTime();
    if (!isRemoteUpdate) {
        if (event.data === YT.PlayerState.PLAYING) {
            socket.emit('playVideo', { videoId: currentVideoId, startTime: currentTime });
        } else if (event.data === YT.PlayerState.PAUSED) {
            socket.emit('pauseVideo', { videoId: currentVideoId, lastKnownTime: currentTime });
        }
        if (Math.abs(currentTime - prevTime) > 1) {
            socket.emit('seekVideo', { newTime: currentTime });
        }
    } else {
        isRemoteUpdate = false;
    }
    prevTime = currentTime;
}

// Retry mechanism to load player with video
function loadVideoWithRetry(videoId, startTime, attempts = 20) {
    if (attempts <= 0) {
        console.error('Failed to load video after multiple attempts');
        return;
    }
    // Only load if player is ready and video is different
    if (isPlayerReady && player.getVideoData().video_id !== videoId) {
        console.log(`Loading video ${videoId} at ${startTime}`);
        player.loadVideoById(videoId, startTime);
    } else if (!isPlayerReady) {
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
            console.log(`Seeking to ${data.currentTime}`);
            player.seekTo(data.currentTime);
            if (data.isPlaying) {
                console.log('Playing video');
                player.playVideo();
            } else {
                console.log('Pausing video');
                player.pauseVideo();
            }
        } else {
            const checkPlayerReady = setInterval(() => {
                if (isPlayerReady) {
                    console.log(`Seeking to ${data.currentTime} after player is ready`);
                    player.seekTo(data.currentTime);
                    if (data.isPlaying) {
                        console.log('Playing video');
                        player.playVideo();
                    } else {
                        console.log('Pausing video');
                        player.pauseVideo();
                    }
                    clearInterval(checkPlayerReady);
                }
            }, 100);
        }
    }
});


//listen for play, pause, and seek events
socket.on('playEvent', (data) => {
    currentVideoId = data.videoId;
    const elapsed = (Date.now() - data.serverWallClock) / 1000;
    if (isPlayerReady) {
        player.seekTo(data.startTime + elapsed);
        player.playVideo();
    } else {
        const checkPlayerReady = setInterval(() => {
            if (isPlayerReady) {
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
    if (videoId && videoId !== currentVideoId) {
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