// Stella Bistro — Order Confirmation JavaScript

document.addEventListener('DOMContentLoaded', () => {
  const statusTracker = document.querySelector('.status-tracker');
  if (!statusTracker) return;

  const orderNumber = document.querySelector('.confirmation-page__order-number .mono');
  if (!orderNumber) return;

  const num = orderNumber.textContent.replace('#', '').trim();
  const currentStatusEl = document.getElementById('currentStatus');
  const steps = {
    'pending': 'placed',
    'in_progress': 'confirmed',
    'completed': 'delivered',
    'cancelled': 'cancelled'
  };
  const statusLabels = {
    'placed': 'Placed ✓',
    'confirmed': 'Confirmed',
    'out_for_delivery': 'Out for Delivery',
    'delivered': 'Delivered'
  };

  function updateTracker(status) {
    const stepKey = steps[status] || 'placed';
    const allSteps = document.querySelectorAll('.status-step');
    let active = false;

    allSteps.forEach(step => {
      const s = step.dataset.status;
      if (s === stepKey) active = true;
      if (active) {
        step.classList.add('status-step--active');
      } else {
        step.classList.remove('status-step--active');
      }
    });

    if (currentStatusEl) {
      currentStatusEl.textContent = `Status: ${statusLabels[stepKey] || status}`;
    }
  }

  // Initial update
  const initialStatus = document.querySelector('.status-step--active')?.dataset?.status || 'placed';
  updateTracker(initialStatus);

  // Recheck since status might differ from what was rendered
  fetch(`/api/orders/${num}/status`)
    .then(r => r.json())
    .then(data => {
      if (data.status) {
        updateTracker(data.status);
      }
    })
    .catch(() => {});

  // Poll every 20 seconds
  const pollInterval = setInterval(() => {
    fetch(`/api/orders/${num}/status`)
      .then(r => r.json())
      .then(data => {
        if (data.status) {
          updateTracker(data.status);
          if (data.status === 'completed' || data.status === 'cancelled') {
            clearInterval(pollInterval);
          }
        }
      })
      .catch(() => {});
  }, 20000);
});

function toggleItems() {
  const el = document.getElementById('orderItems');
  if (el) {
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
  }
}
