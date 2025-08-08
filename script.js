// Messenger + Mobile Share Button Logic
document.getElementById('shareResultBtn').addEventListener('click', function() {
    // Get the score details
    const name = examTakerName;
    const score = document.getElementById('score').textContent;
    const url = window.location.href;

    const shareText = `${score} Try the TTVHS REMEDIAL EXAM FOR TLE here:\n${url}`;

    if (navigator.share) {
        // Mobile/web native share
        navigator.share({
            title: 'Exam Result',
            text: shareText,
            url: url
        });
    } else {
        // Facebook Messenger Share Dialog fallback
        // Replace YOUR_FACEBOOK_APP_ID with your real Facebook App ID!
        const app_id = 'YOUR_FACEBOOK_APP_ID';
        const fbUrl =
          `https://www.facebook.com/dialog/send?app_id=${app_id}` +
          `&link=${encodeURIComponent(url)}` +
          `&redirect_uri=${encodeURIComponent(url)}` +
          `&display=popup`;

        window.open(fbUrl, '_blank');
    }
});
