// debug("starting...");

const fileInput = document.querySelector('input[type="file"]');

// debug("attaching listener. ");
fileInput.addEventListener('change', (event) => {
  // debug("listener triggered. ");

  // Get the selected file
  const file = event.target.files[0];
  const reader = new FileReader();

  reader.onload = () => {
    // debug("file loaded. ");

    const img = new Image();
    img.src = reader.result;
    img.id = "image";
    document.querySelector('#image-container').appendChild(img);

    // debug("image appended. ");

    document.querySelector("input").classList.add('hidden');
    setTimeout(() => attachClickHandler(img), 10);
    // debug("click handler attached. ");
  };

  reader.readAsDataURL(file);
});