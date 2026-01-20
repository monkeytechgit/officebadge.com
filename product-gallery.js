/* Product Gallery - Thumbnail Image Switcher */
(() => {
  function initProductGallery() {
    const mainImage = document.querySelector('.product-image img');
    const thumbnails = document.querySelectorAll('.product-thumbnails a');

    if (!mainImage || !thumbnails.length) return;

    thumbnails.forEach((thumbnail, index) => {
      thumbnail.addEventListener('click', (e) => {
        e.preventDefault();
        
        const thumbnailImg = thumbnail.querySelector('img');
        if (!thumbnailImg) return;

        // Get the src from the thumbnail
        const newSrc = thumbnailImg.src;
        const newAlt = thumbnailImg.alt.replace(' thumbnail', '').replace(' thumbnail 2', '');

        // Update main image
        mainImage.src = newSrc;
        mainImage.alt = newAlt;

        // Update active state on thumbnails
        thumbnails.forEach(t => t.classList.remove('active'));
        thumbnail.classList.add('active');
      });
    });

    // Set first thumbnail as active by default
    if (thumbnails[0]) {
      thumbnails[0].classList.add('active');
    }
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProductGallery);
  } else {
    initProductGallery();
  }
})();
