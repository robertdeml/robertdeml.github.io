var imageCapture;

async function onCaptureMap() {
    await onGetUserMediaButtonClick();
}
const videoOptions = { facingMode:{ exact: "environment"} };
const videoOptionLatptop = { video: true};

// get a list of available cameras
async function onGetUserMediaButtonClick() {
    navigator.mediaDevices.getUserMedia({ video: videoOptionLatptop } )
        .then(async mediaStream => {

            const track = mediaStream.getVideoTracks()[0];
            imageCapture = new ImageCapture(track);

            onTakePhotoButtonClick();

            setTimeout( () => {
            mediaStream.getTracks().forEach(function(track) {
                track.stop();
              });
            }, 5000);
        })
        .catch(error => console.log(error));
}

function onTakePhotoButtonClick() {
    return imageCapture.takePhoto()
        .then(blob => createImageBitmap(blob))
        .then(imageBitmap => {
            const canvas = document.querySelector('#image');
            canvas.style.width = imageBitmap.width + "px";
            canvas.style.height = imageBitmap.height + "px";

            drawCanvas(canvas, imageBitmap);
        })
        .catch(error => console.log(error));
}

/* Utils */

function drawCanvas(canvas, img) {
    canvas.width = getComputedStyle(canvas).width.split('px')[0];
    canvas.height = getComputedStyle(canvas).height.split('px')[0];
    let ratio = Math.min(canvas.width / img.width, canvas.height / img.height);
    let x = (canvas.width - img.width * ratio) / 2;
    let y = (canvas.height - img.height * ratio) / 2;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    canvas.getContext('2d').drawImage(img, 0, 0, img.width, img.height,
        x, y, img.width * ratio, img.height * ratio);
}

document.getElementById('captureMap').addEventListener('click', onCaptureMap);

