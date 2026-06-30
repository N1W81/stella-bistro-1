// Stella Bistro — Checkout Page JavaScript

document.addEventListener('DOMContentLoaded', () => {

  const form = document.getElementById('checkoutForm');
  if (!form) return;

  const items = Cart.getItems();
  const subtotal = Cart.getSubtotal();

  // Redirect if cart empty
  if (items.length === 0) {
    window.location.href = '/menu';
    return;
  }

  // Load payment info from API
  let paymentInfo = null;
  let deliveryFee = 100;
  let appliedDiscount = 0;
  let appliedCode = '';

  // Display order summary
  function renderSummary() {
    const container = document.getElementById('checkoutItems');
    if (!container) return;

    let html = '';
    items.forEach(item => {
      const imgHtml = item.image
        ? `<img src="${item.image}" alt="${item.name}" class="checkout-summary__item-img">`
        : `<div class="checkout-summary__item-img" style="background:#1A1A1A;display:flex;align-items:center;justify-content:center;font-size:16px;color:var(--gold);">${item.name.charAt(0)}</div>`;
      html += `
        <div class="checkout-summary__item">
          ${imgHtml}
          <div class="checkout-summary__item-info">
            <div class="checkout-summary__item-name">${item.name}</div>
            <div class="checkout-summary__item-qty">Qty: ${item.quantity}</div>
          </div>
          <div class="checkout-summary__item-price">Rs. ${Math.round(item.price * item.quantity)}</div>
        </div>`;
    });
    container.innerHTML = html;

    updateTotals();
  }

  function updateTotals() {
    const sub = subtotal;
    const total = Math.max(0, sub + deliveryFee - appliedDiscount);

    document.getElementById('checkoutSubtotal').textContent = `Rs. ${Math.round(sub)}`;
    document.getElementById('checkoutDeliveryFee').textContent = `Rs. ${deliveryFee}`;

    const discountRow = document.getElementById('checkoutDiscountRow');
    if (appliedDiscount > 0) {
      discountRow.style.display = 'flex';
      document.getElementById('checkoutDiscount').textContent = `-Rs. ${Math.round(appliedDiscount)}`;
    } else {
      discountRow.style.display = 'none';
    }

    document.getElementById('checkoutTotal').textContent = `Rs. ${Math.round(total)}`;

    // Update hidden fields
    document.getElementById('itemsJsonInput').value = JSON.stringify(items);
    document.getElementById('subtotalInput').value = sub;
    document.getElementById('deliveryFeeInput').value = deliveryFee;
    document.getElementById('promoCodeInput').value = appliedCode;
    document.getElementById('promoDiscountInput').value = appliedDiscount;
  }

  // Render payment methods
  function renderPaymentMethods(info) {
    const container = document.getElementById('paymentMethods');
    if (!container) return;

    const total = Math.max(0, subtotal + deliveryFee - appliedDiscount);
    const methods = [
      {
        id: 'jazzcash',
        label: 'JazzCash',
        icon: '🟢',
        desc: 'Mobile Account Transfer',
        enabled: info.jazzcash.enabled,
        detailsHtml: `
          <p>Send <strong>Rs. ${Math.round(total)}</strong> to:</p>
          <p><strong>Number:</strong> ${info.jazzcash.number}</p>
          <p><strong>Account Name:</strong> ${info.jazzcash.name}</p>
          <div class="form-group" style="margin-top:8px;">
            <label>Transaction ID *</label>
            <input type="text" class="input txn-input" name="txn_jazzcash" required>
          </div>
          <div class="form-group" style="margin-top:8px;">
            <label>Upload Payment Screenshot (optional)</label>
            <input type="file" class="input screenshot-input" accept="image/*">
          </div>`
      },
      {
        id: 'easypaisa',
        label: 'EasyPaisa',
        icon: '🟠',
        desc: 'Mobile Account Transfer',
        enabled: info.easypaisa.enabled,
        detailsHtml: `
          <p>Send <strong>Rs. ${Math.round(total)}</strong> to:</p>
          <p><strong>Number:</strong> ${info.easypaisa.number}</p>
          <p><strong>Account Name:</strong> ${info.easypaisa.name}</p>
          <div class="form-group" style="margin-top:8px;">
            <label>Transaction ID *</label>
            <input type="text" class="input txn-input" name="txn_easypaisa" required>
          </div>
          <div class="form-group" style="margin-top:8px;">
            <label>Upload Payment Screenshot (optional)</label>
            <input type="file" class="input screenshot-input" accept="image/*">
          </div>`
      },
      {
        id: 'meezan',
        label: 'Meezan Bank',
        icon: '🔵',
        desc: 'Bank Transfer',
        enabled: info.meezan.enabled,
        detailsHtml: `
          <p style="white-space:pre-line;">${info.meezan.details}</p>
          <div class="form-group" style="margin-top:8px;">
            <label>Transaction ID / Reference *</label>
            <input type="text" class="input txn-input" name="txn_meezan" required>
          </div>
          <div class="form-group" style="margin-top:8px;">
            <label>Upload Payment Screenshot (optional)</label>
            <input type="file" class="input screenshot-input" accept="image/*">
          </div>`
      },
      {
        id: 'hbl',
        label: 'HBL / Bank Transfer',
        icon: '🔴',
        desc: 'Online Banking / Interbank',
        enabled: info.hbl.enabled,
        detailsHtml: `
          <p style="white-space:pre-line;">${info.hbl.details}</p>
          <div class="form-group" style="margin-top:8px;">
            <label>Transaction ID / Reference *</label>
            <input type="text" class="input txn-input" name="txn_hbl" required>
          </div>
          <div class="form-group" style="margin-top:8px;">
            <label>Upload Payment Screenshot (optional)</label>
            <input type="file" class="input screenshot-input" accept="image/*">
          </div>`
      },
      {
        id: 'cod',
        label: 'Cash on Delivery',
        icon: '💵',
        desc: 'Pay when your order arrives',
        enabled: info.cod.enabled,
        detailsHtml: ''
      }
    ];

    let html = '';
    methods.forEach((m, idx) => {
      const disabled = !m.enabled;
      html += `
        <div class="payment-method ${disabled ? 'payment-method--disabled' : ''}" data-method="${m.id}" onclick="${disabled ? '' : `selectPayment('${m.id}')`}">
          <span style="font-size:20px;">${m.icon}</span>
          <div style="flex:1;">
            <strong>${m.label}</strong>
            <div style="font-size:12px;color:var(--text-secondary);">${disabled ? 'Currently unavailable' : m.desc}</div>
          </div>
        </div>
        <div class="payment-method__details" id="details-${m.id}">
          ${m.detailsHtml}
        </div>`;
    });
    container.innerHTML = html;
  }

  window.selectPayment = function(method) {
    // Update active state
    document.querySelectorAll('.payment-method').forEach(el => {
      el.classList.remove('payment-method--active');
    });
    document.querySelector(`.payment-method[data-method="${method}"]`).classList.add('payment-method--active');

    // Hide all details
    document.querySelectorAll('.payment-method__details').forEach(el => {
      el.classList.remove('payment-method__details--open');
    });

    // Show selected details
    const details = document.getElementById(`details-${method}`);
    if (details) {
      details.classList.add('payment-method__details--open');
    }

    document.getElementById('paymentMethodInput').value = method;
  };

  // Load payment info
  fetch('/api/payment-info')
    .then(r => r.json())
    .then(data => {
      paymentInfo = data;
      deliveryFee = parseFloat(data.delivery_fee) || 100;
      document.getElementById('estimatedDelivery').textContent = data.estimated_delivery_time || '30–45 minutes';
      renderPaymentMethods(data);
      updateTotals();
    })
    .catch(() => {
      // Use defaults
      paymentInfo = {
        jazzcash: { enabled: true, number: '03XX-XXXXXXX', name: 'Stella Bistro' },
        easypaisa: { enabled: true, number: '03XX-XXXXXXX', name: 'Stella Bistro' },
        meezan: { enabled: true, details: 'Account: Stella Bistro' },
        hbl: { enabled: true, details: 'Bank: HBL' },
        cod: { enabled: true, max_amount: 0 }
      };
      renderPaymentMethods(paymentInfo);
    });

  renderSummary();

  // Promo code
  document.getElementById('applyPromo')?.addEventListener('click', () => {
    const code = document.getElementById('promoCode').value.trim();
    if (!code) return;

    fetch('/api/promo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, subtotal })
    })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        appliedDiscount = data.discount;
        appliedCode = data.code;
        updateTotals();
        document.getElementById('promoCode').disabled = true;
        document.getElementById('applyPromo').disabled = true;
        document.getElementById('applyPromo').textContent = 'Applied ✓';
      } else {
        alert(data.error || 'Invalid promo code');
      }
    })
    .catch(() => alert('Failed to validate promo code'));
  });

  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const paymentMethod = document.getElementById('paymentMethodInput').value;
    if (!paymentMethod) {
      alert('Please select a payment method');
      return;
    }

    if (!document.getElementById('termsCheck').checked) {
      alert('Please confirm your order details');
      return;
    }

    // Get transaction ID
    let transactionId = '';
    if (paymentMethod !== 'cod') {
      const txnInput = document.querySelector(`#details-${paymentMethod} .txn-input`);
      if (txnInput) {
        transactionId = txnInput.value.trim();
        if (!transactionId) {
          alert('Please enter the transaction ID');
          return;
        }
      }
    }

    // Get screenshot file
    const screenshotInput = document.querySelector(`#details-${paymentMethod} .screenshot-input`);
    const screenshotFile = screenshotInput?.files?.[0] || null;

    const formData = new FormData();
    formData.append('customer_name', document.getElementById('customer_name').value);
    formData.append('customer_phone', document.getElementById('customer_phone').value);
    formData.append('delivery_address', document.getElementById('delivery_address').value);
    formData.append('landmark', document.getElementById('landmark')?.value || '');
    formData.append('city', document.getElementById('city')?.value || 'Karachi');
    formData.append('special_instructions', document.getElementById('special_instructions')?.value || '');
    formData.append('payment_method', paymentMethod);
    formData.append('transaction_id', transactionId);
    formData.append('items_json', JSON.stringify(items));
    formData.append('subtotal', subtotal);
    formData.append('delivery_fee', deliveryFee);
    formData.append('promo_code', appliedCode);
    formData.append('promo_discount', appliedDiscount);

    if (screenshotFile) {
      formData.append('payment_screenshot', screenshotFile);
    }

    const btn = document.getElementById('placeOrderBtn');
    btn.disabled = true;
    btn.textContent = 'Placing Order...';

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (data.success) {
        Cart.clearCart();
        window.location.href = `/order-confirmation/${data.order_number}`;
      } else {
        alert(data.error || 'Failed to place order');
        btn.disabled = false;
        btn.textContent = 'Place Order →';
      }
    } catch(e) {
      alert('Network error. Please try again.');
      btn.disabled = false;
      btn.textContent = 'Place Order →';
    }
  });
});
