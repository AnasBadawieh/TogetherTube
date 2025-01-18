// linkExtrcat.js
function getYouTubeEmbedLink(url) {
    try {
        // Use URL constructor to parse the input URL
        const parsedUrl = new URL(url);

        // Check if the hostname matches YouTube or youtu.be
        if (parsedUrl.hostname === 'www.youtube.com' || parsedUrl.hostname === 'youtube.com') {
            // Extract the 'v' parameter value (video ID)
            const videoID = parsedUrl.searchParams.get('v');
            if (videoID) {
                return `https://www.youtube.com/embed/${videoID}`;
            }
        } else if (parsedUrl.hostname === 'youtu.be') {
            // For short links, the video ID is the pathname
            const videoID = parsedUrl.pathname.substring(1); // Remove the leading '/'
            if (videoID) {
                return `https://www.youtube.com/embed/${videoID}`;
            }
        }

        // If the URL doesn't match the expected pattern, return null or an error
        return 'Invalid YouTube URL';
    } catch (error) {
        return 'Error processing the URL';
    }
}