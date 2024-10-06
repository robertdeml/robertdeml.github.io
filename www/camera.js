// Import the Capacitor Camera API
import { Camera, CameraResultType } from '@capacitor/camera';

const fileInput = document.querySelector('input[type="file"]');
const cameraButton = document.querySelector('#camera-button');

// Add a listener for file input changes
fileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  const reader = new FileReader();

  reader.onload = () => {
    const img = new Image();
    img.src = reader.result;
    img.id = "image";
    document.querySelector('#image-container').appendChild(img);

    document.querySelector("input").classList.add('hidden');
    setTimeout(() => attachClickHandler(img), 10);
  };

  reader.readAsDataURL(file);
});

// Add a listener for the camera button to capture a photo
cameraButton.addEventListener('click', async () => {
  try {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.DataUrl,
      source: Camera.Source.Camera,
      quality: 90,
      allowEditing: false
    });

    const img = new Image();
    img.src = photo.dataUrl;
    img.id = "image";
    document.querySelector('#image-container').appendChild(img);

    setTimeout(() => attachClickHandler(img), 10);
  } catch (error) {
    console.error("Error capturing photo: ", error);
  }
});

// Function to attach click handler to the image
function attachClickHandler(image) {
  const rect = document.querySelector('#image-container').getBoundingClientRect();
  imgOffsetX = rect.x;
  imgOffsetY = rect.y;

  image.addEventListener("click", (e) => {
    if (lockMapState) return;
    imageClickHandler(e.clientX - imgOffsetX, e.clientY - imgOffsetY);
  });

  document.querySelector("#clear-footprints").addEventListener('click', () => clearFootprints());
  document.querySelector("#point-up").addEventListener('click', () => movePoint(0, -1));
  document.querySelector("#point-down").addEventListener('click', () => movePoint(0, 1));
  document.querySelector("#point-left").addEventListener('click', () => movePoint(-1, 0));
  document.querySelector("#point-right").addEventListener('click', () => movePoint(1, 0));
  document.querySelector("#lockUnlockSwitch").addEventListener('change', (e) => toggleMapLock(e));
}