// Stella Bistro — Cart Module
// Uses localStorage key "stella_cart"

const Cart = {
  STORAGE_KEY: 'stella_cart',

  getItems() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || [];
    } catch(e) {
      return [];
    }
  },

  saveItems(items) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(items));
    } catch(e) {
      console.warn('Cart save failed:', e);
    }
    this.updateUI();
  },

  addItem(id, name, price, image = '', quantity = 1) {
    const items = this.getItems();
    const existing = items.find(item => item.id === id);
    if (existing) {
      existing.quantity += quantity;
    } else {
      items.push({ id, name, price, image, quantity });
    }
    this.saveItems(items);
    this.showAddedFeedback(name);
  },

  removeItem(id) {
    let items = this.getItems();
    const item = items.find(i => i.id === id);
    if (item && item.quantity > 1) {
      item.quantity -= 1;
    } else {
      items = items.filter(i => i.id !== id);
    }
    this.saveItems(items);
  },

  deleteItem(id) {
    const items = this.getItems().filter(i => i.id !== id);
    this.saveItems(items);
  },

  clearCart() {
    this.saveItems([]);
  },

  getItemCount() {
    return this.getItems().reduce((sum, item) => sum + item.quantity, 0);
  },

  getSubtotal() {
    return this.getItems().reduce((sum, item) => sum + (item.price * item.quantity), 0);
  },

  showAddedFeedback(name) {
    const btn = document.querySelector(`button[data-name="${name.replace(/'/g, "\\'")}"]`);
    if (btn) {
      const original = btn.textContent;
      btn.textContent = '✓ Added!';
      btn.classList.add('btn--gold');
      btn.classList.remove('btn--outline');
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove('btn--gold');
        btn.classList.add('btn--outline');
      }, 1200);
    }
  },

  updateUI() {
    const items = this.getItems();
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Update badge
    const badge = document.getElementById('cartBadge');
    if (badge) badge.textContent = count;

    // Update sidebar
    const cartItems = document.getElementById('cartItems');
    const cartFooter = document.getElementById('cartFooter');
    const cartCount = document.getElementById('cartCount');

    if (cartCount) cartCount.textContent = `${count} item${count !== 1 ? 's' : ''}`;

    if (count === 0) {
      if (cartItems) cartItems.innerHTML = `<div class="cart-sidebar__empty"><p>Your cart is empty. Start adding dishes 🍽️</p><a href="/menu" class="btn btn--outline" style="margin-top:1rem;">Browse Menu</a></div>`;
      if (cartFooter) cartFooter.style.display = 'none';
    } else {
      let html = '';
      items.forEach(item => {
        const imgHtml = item.image
          ? `<img src="${item.image}" alt="${item.name}" class="cart-sidebar__item-img">`
          : `<div class="cart-sidebar__item-img" style="background:#1A1A1A;display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--gold);">${item.name.charAt(0)}</div>`;
        html += `
          <div class="cart-sidebar__item">
            ${imgHtml}
            <div class="cart-sidebar__item-info">
              <div class="cart-sidebar__item-name">${item.name}</div>
              <div class="cart-sidebar__item-price">Rs. ${Math.round(item.price * item.quantity)}</div>
            </div>
            <div class="cart-sidebar__qty">
              <button class="cart-sidebar__qty-btn" onclick="Cart.removeItem('${item.id}')">−</button>
              <span class="cart-sidebar__qty-value">${item.quantity}</span>
              <button class="cart-sidebar__qty-btn" onclick="Cart.addItem('${item.id}','${item.name.replace(/'/g, "\\'")}',${item.price},'${item.image || ''}')">+</button>
            </div>
          </div>`;
      });
      if (cartItems) cartItems.innerHTML = html;
      if (cartFooter) {
        cartFooter.style.display = 'block';
        document.getElementById('cartSubtotal').textContent = `Rs. ${Math.round(subtotal)}`;
        // Get delivery fee - could be from a data attribute or global
        const deliveryFee = parseFloat(document.body.dataset.deliveryFee) || 100;
        document.getElementById('cartDeliveryFee').textContent = `Rs. ${deliveryFee}`;
        document.getElementById('cartTotal').textContent = `Rs. ${Math.round(subtotal + deliveryFee)}`;
      }
    }

    // Save subtotal to body data for checkout
    document.body.dataset.cartSubtotal = subtotal;
  },

  init() {
    // Add to cart buttons
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.dish-card__add');
      if (btn && !btn.disabled) {
        const id = btn.dataset.id;
        const name = btn.dataset.name;
        const price = parseFloat(btn.dataset.price);
        const image = btn.dataset.image || '';
        this.addItem(id, name, price, image);
      }
    });

    this.updateUI();
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Cart.init());
} else {
  Cart.init();
}
