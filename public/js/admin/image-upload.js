// Stella Bistro — Image Upload Component (shared across admin)

function initImageUpload(zoneSelector, inputSelector) {
  const zones = document.querySelectorAll(zoneSelector || '.image-upload-zone');
  
  zones.forEach(zone => {
    const input = zone.querySelector('input[type="file"]') || 
                 zone.parentElement.querySelector(inputSelector || 'input[type="file"]') ||
                 zone.nextElementSibling?.querySelector('input[type="file"]');

    if (!input) return;

    // Click to upload
    zone.addEventListener('click', () => input.click());

    // Preview on change
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        zone.innerHTML = `<img src="${e.target.result}" alt="Preview" style="max-width:200px;max-height:120px;border-radius:4px;object-fit:cover;">`;
        zone.style.border = 'none';
        zone.style.padding = '0';
      };
      reader.readAsDataURL(file);
    });

    // Drag and drop
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.style.borderColor = 'var(--gold)';
      zone.style.background = 'rgba(201,168,76,0.05)';
    });

    zone.addEventListener('dragleave', () => {
      zone.style.borderColor = '';
      zone.style.background = '';
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.style.borderColor = '';
      zone.style.background = '';
      
      const file = e.dataTransfer.files[0];
      if (file && file.type.match(/image\/(jpeg|png|webp)/)) {
        input.files = e.dataTransfer.files;
        input.dispatchEvent(new Event('change'));
      }
    });
  });
}

// Auto-init on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initImageUpload();
});
