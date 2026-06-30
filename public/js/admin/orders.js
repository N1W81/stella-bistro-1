// Stella Bistro — Admin Orders JavaScript (WebSocket + Kanban)

document.addEventListener('DOMContentLoaded', () => {
  const pendingBadge = document.getElementById('pendingBadge');

  // Update pending count badge in sidebar
  function updatePendingBadge() {
    const pendingCards = document.querySelectorAll('#pendingOrders .order-card');
    if (pendingBadge) {
      pendingBadge.textContent = pendingCards.length;
    }
  }
  updatePendingBadge();

  // ─── WebSocket connection ───
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws/orders`;
  let ws = null;

  function connectWebSocket() {
    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => console.log('Orders WebSocket connected');

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch(e) {
          console.warn('WS parse error:', e);
        }
      };

      ws.onclose = () => {
        console.log('Orders WebSocket disconnected, reconnecting in 5s...');
        setTimeout(connectWebSocket, 5000);
      };

      ws.onerror = (e) => console.warn('WS error:', e);
    } catch(e) {
      console.warn('WS connection failed, retrying in 10s...');
      setTimeout(connectWebSocket, 10000);
    }
  }

  function handleWebSocketMessage(data) {
    if (data.type === 'new_order' && data.order) {
      playNotificationSound();
      // Reload to show new order
      location.reload();
    } else if (data.type === 'order_updated') {
      // Optionally reload
      location.reload();
    }
  }

  // ─── Notification Sound (Web Audio API) ───
  function playNotificationSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.frequency.value = 880;
      oscillator.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);
    } catch(e) {
      // Audio not supported
    }
  }

  // ─── Status Update ───
  window.updateStatus = function(orderId, status) {
    fetch(`/stella-control/orders/${orderId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ status })
    })
    .then(r => r.json())
    .then(data => {
      if (data.success) location.reload();
    })
    .catch(() => location.reload());
  };

  // ─── Cancel Order ───
  window.cancelOrder = function(orderId) {
    const reason = prompt('Reason for cancellation:');
    if (reason === null) return;

    fetch(`/stella-control/orders/${orderId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ status: 'cancelled', cancellation_reason: reason })
    })
    .then(r => r.json())
    .then(data => {
      if (data.success) location.reload();
    })
    .catch(() => location.reload());
  };

  // ─── Payment Verification ───
  window.togglePaymentVerify = function(orderId, verified) {
    fetch(`/stella-control/orders/${orderId}/verify-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verified })
    }).catch(() => {});
  };

  // ─── Order Search Filter ───
  window.filterOrders = function() {
    const search = document.getElementById('orderSearch')?.value?.toLowerCase().trim() || '';
    document.querySelectorAll('.order-card').forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = search ? (text.includes(search) ? '' : 'none') : '';
    });
  };

  // ─── Kanban column empty state ───
  document.querySelectorAll('.kanban__cards').forEach(col => {
    if (col.children.length === 0 || (col.children.length === 1 && col.querySelector('.kanban__empty'))) {
      if (!col.querySelector('.kanban__empty')) {
        col.innerHTML = '<div class="kanban__empty">No orders</div>';
      }
    }
  });

  // Connect WebSocket
  connectWebSocket();
});
