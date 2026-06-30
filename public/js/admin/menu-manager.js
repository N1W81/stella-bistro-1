// Stella Bistro — Menu Manager JavaScript

// Store items data for editing
let menuItems = {};

function editItem(itemId) {
  // Find the form and populate it
  const row = document.querySelector(`[data-id="${itemId}"]`)?.closest('tr');
  if (!row) return;

  const cells = row.querySelectorAll('td');
  const name = cells[1]?.textContent?.trim() || '';
  const price = cells[2]?.textContent?.replace('Rs. ', '')?.trim() || '';
  const tags = cells[4]?.textContent?.trim() || '';

  // Show a simple prompt-based edit for now
  const newName = prompt('Item name:', name);
  if (!newName) return;

  const newPrice = prompt('Base price (PKR):', price);
  if (!newPrice) return;

  // Submit via form
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = `/stella-control/menu/item/update/${itemId}`;
  form.enctype = 'multipart/form-data';

  const fields = {
    name: newName,
    base_price: newPrice,
    original_price: newPrice,
    category_id: document.querySelector('[name="category_id"]')?.value || '1',
    description: '',
    discount_enabled: '0',
    discount_type: 'percentage',
    discount_value: '0',
    kitchen_notes: '',
    display_order: '0',
    visible: '1',
    available: '1',
    is_new: '0'
  };

  Object.entries(fields).forEach(([k, v]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = k;
    input.value = v;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}

function closeEdit() {
  document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
}

function previewEditImage(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const preview = document.getElementById('editImagePreview');
    if (preview) {
      preview.innerHTML = `<img src="${e.target.result}" style="max-width:200px;max-height:120px;border-radius:4px;">`;
    }
  };
  reader.readAsDataURL(file);
}

// Drag and drop support for upload zones
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.image-upload-zone').forEach(zone => {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.style.borderColor = 'var(--gold)';
    });
    zone.addEventListener('dragleave', () => {
      zone.style.borderColor = '';
    });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.style.borderColor = '';
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const input = zone.nextElementSibling?.querySelector('input[type="file"]') || zone.querySelector('input[type="file"]');
        if (input) {
          input.files = files;
          input.dispatchEvent(new Event('change'));
        }
      }
    });
  });
});
