var imageCapture;


debug("starting...");
// async function onCaptureMap() {
//     await onGetUserMediaButtonClick();
// }
// const videoOptions = { facingMode:{ exact: "environment"} };
// const videoOptionLatptop = { video: true};

// // get a list of available cameras
// async function onGetUserMediaButtonClick() {
//     navigator.mediaDevices.getUserMedia({ video: videoOptionLatptop } )
//         .then(async mediaStream => {

//             const track = mediaStream.getVideoTracks()[0];
//             imageCapture = new ImageCapture(track);

//             onTakePhotoButtonClick();

//             setTimeout( () => {
//             mediaStream.getTracks().forEach(function(track) {
//                 track.stop();
//               });
//             }, 5000);
//         })
//         .catch(error => console.log(error));
// }

// function onTakePhotoButtonClick() {
//     return imageCapture.takePhoto()
//         .then(blob => createImageBitmap(blob))
//         .then(imageBitmap => {
//             const canvas = document.querySelector('#image');
//             canvas.style.width = imageBitmap.width + "px";
//             canvas.style.height = imageBitmap.height + "px";

//             drawCanvas(canvas, imageBitmap);
//         })
//         .catch(error => console.log(error));
// }

/* Utils */

// function drawCanvas(canvas, img) {
//     canvas.width = getComputedStyle(canvas).width.split('px')[0];
//     canvas.height = getComputedStyle(canvas).height.split('px')[0];
//     let ratio = Math.min(canvas.width / img.width, canvas.height / img.height);
//     let x = (canvas.width - img.width * ratio) / 2;
//     let y = (canvas.height - img.height * ratio) / 2;
//     canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
//     canvas.getContext('2d').drawImage(img, 0, 0, img.width, img.height,
//         x, y, img.width * ratio, img.height * ratio);
// }

// document.getElementById('captureMap').addEventListener('click', onCaptureMap);

const fileInput = document.querySelector('input[type="file"]');


debug("attaching listener. ");
fileInput.addEventListener('change', (event) => {
  debug("listener triggered. ");

  // Get the selected file
  const file = event.target.files[0];
  const reader = new FileReader();

  reader.onload = () => {
    debug("file loaded. ");

    const img = new Image();
    img.src = reader.result;
    img.id = "image";
    document.querySelector('#image-container').appendChild(img);

    debug("image appended. ");

    attachClickHandler(img);
    debug("click handler attached. ");
  };

  reader.readAsDataURL(file);
});
