const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query, run } = require('../db/database');

// Multer config for payment screenshots
const paymentStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'public', 'uploads', 'payment')),
  filename: (req, file, cb) => cb(null, `payment_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.]/g, '_')}`),
});

const paymentUpload = multer({
  storage: paymentStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only jpg, png, webp allowed'));
  },
});

// Helper to compute display price
function computeDisplayPrice(item) {
  if (!item.discount_enabled) return item.base_price;
  if (item.discount_type === 'percentage') {
    return Math.max(1, Math.round(item.base_price * (1 - item.discount_value / 100) * 100) / 100);
  }
  if (item.discount_type === 'fixed') {
    return Math.max(1, item.base_price - item.discount_value);
  }
  return item.base_price;
}

// POST /api/orders — place an order
router.post('/orders', paymentUpload.single('payment_screenshot'), (req, res) => {
  try {
    const { customer_name, customer_phone, delivery_address, landmark, city, special_instructions, payment_method, transaction_id, items_json, subtotal, delivery_fee, promo_code, promo_discount } = req.body;

    // Validation
    if (!customer_name || !customer_phone || !delivery_address || !payment_method || !items_json) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (payment_method !== 'cod' && !transaction_id) {
      return res.status(400).json({ error: 'Transaction ID required for digital payments' });
    }

    const items = JSON.parse(items_json);
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const sub = parseFloat(subtotal) || 0;
    const fee = parseFloat(delivery_fee) || 0;
    const disc = parseFloat(promo_discount) || 0;
    const total = Math.max(0, sub + fee - disc);

    // Check minimum order
    const settings = getSettingsObj();
    const minOrder = parseFloat(settings.min_order) || 0;
    if (sub < minOrder) {
      return res.status(400).json({ error: `Minimum order amount is Rs. ${minOrder}` });
    }

    // Validate promo code
    if (promo_code) {
      const promos = query('SELECT * FROM promo_codes WHERE code = ? AND active = 1', [promo_code.toUpperCase()]);
      if (promos.length === 0) {
        return res.status(400).json({ error: 'Invalid promo code' });
      }
      const promo = promos[0];
      if (promo.expiry_date && new Date(promo.expiry_date) < new Date()) {
        return res.status(400).json({ error: 'Promo code has expired' });
      }
      if (promo.usage_limit && promo.times_used >= promo.usage_limit) {
        return res.status(400).json({ error: 'Promo code usage limit reached' });
      }
    }

    // Generate order number
    const orderCount = query('SELECT COUNT(*) as c FROM orders');
    const count = orderCount[0]?.c || 0;
    const orderNumber = `SB-${String(count + 1).padStart(4, '0')}`;

    const screenshotPath = req.file ? `/uploads/payment/${req.file.filename}` : null;

    run(`INSERT INTO orders (order_number, customer_name, customer_phone, delivery_address, landmark, city, special_instructions, payment_method, transaction_id, payment_screenshot, items_json, subtotal, delivery_fee, total, promo_code, promo_discount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderNumber, customer_name, customer_phone, delivery_address, landmark || null, city || null, special_instructions || null, payment_method, transaction_id || null, screenshotPath, items_json, sub, fee, total, promo_code || null, disc]
    );

    // Increment promo usage
    if (promo_code) {
      run('UPDATE promo_codes SET times_used = times_used + 1 WHERE code = ?', [promo_code.toUpperCase()]);
    }

    // Broadcast new order via WebSocket
    if (req.broadcastOrder) {
      const newOrder = query('SELECT * FROM orders WHERE order_number = ?', [orderNumber]);
      if (newOrder.length > 0) {
        req.broadcastOrder({ type: 'new_order', order: newOrder[0] });
      }
    }

    res.json({ success: true, order_number: orderNumber });
  } catch (e) {
    console.error('Order creation error:', e);
    res.status(500).json({ error: 'Failed to place order' });
  }
});

// GET /api/orders/:orderNumber/status
router.get('/orders/:orderNumber/status', (req, res) => {
  try {
    const orders = query('SELECT order_number, status, created_at FROM orders WHERE order_number = ?', [req.params.orderNumber]);
    if (orders.length === 0) return res.status(404).json({ error: 'Order not found' });
    res.json(orders[0]);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/reservations
router.post('/reservations', (req, res) => {
  try {
    const { name, phone, email, date, time, guests, occasion, special_requests } = req.body;

    if (!name || !phone || !date || !time || !guests) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    run(`INSERT INTO reservations (name, phone, email, date, time, guests, occasion, special_requests)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, phone, email || null, date, time, parseInt(guests), occasion || null, special_requests || null]
    );

    res.json({ success: true, message: 'Reservation confirmed!' });
  } catch (e) {
    console.error('Reservation error:', e);
    res.status(500).json({ error: 'Failed to create reservation' });
  }
});

// POST /api/promo — validate promo code
router.post('/promo', (req, res) => {
  try {
    const { code, subtotal } = req.body;
    if (!code) return res.status(400).json({ error: 'Promo code is required' });

    const promos = query('SELECT * FROM promo_codes WHERE code = ? AND active = 1', [code.toUpperCase()]);

    if (promos.length === 0) {
      return res.status(400).json({ error: 'Invalid promo code' });
    }

    const promo = promos[0];

    if (promo.expiry_date && new Date(promo.expiry_date) < new Date()) {
      return res.status(400).json({ error: 'Promo code has expired' });
    }

    if (promo.usage_limit && promo.times_used >= promo.usage_limit) {
      return res.status(400).json({ error: 'Promo code usage limit reached' });
    }

    if (promo.min_order > 0 && subtotal < promo.min_order) {
      return res.status(400).json({ error: `Minimum order of Rs. ${promo.min_order} required` });
    }

    let discount = 0;
    if (promo.discount_type === 'percentage') {
      discount = Math.round(subtotal * (promo.discount_value / 100));
    } else {
      discount = promo.discount_value;
    }

    res.json({ success: true, code: promo.code, discount, discount_type: promo.discount_type, discount_value: promo.discount_value });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/payment-info — get payment info for checkout
router.get('/payment-info', (req, res) => {
  const settings = getSettingsObj();
  res.json({
    jazzcash: { number: settings.jazzcash_number, name: settings.jazzcash_name, enabled: settings.jazzcash_enabled === '1' },
    easypaisa: { number: settings.easypaisa_number, name: settings.easypaisa_name, enabled: settings.easypaisa_enabled === '1' },
    meezan: { details: settings.meezan_details, enabled: settings.meezan_enabled === '1' },
    hbl: { details: settings.hbl_details, enabled: settings.hbl_enabled === '1' },
    cod: { enabled: settings.cod_enabled === '1', max_amount: settings.cod_max_amount },
    delivery_fee: settings.delivery_fee,
    free_delivery_above: settings.free_delivery_above,
    min_order: settings.min_order,
    estimated_delivery_time: settings.estimated_delivery_time,
  });
});

// GET /api/analytics
router.get('/analytics', (req, res) => {
  try {
    // Validate and sanitize date params
    const { from, to } = req.query;
    const validFrom = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : '';
    const validTo = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : '';

    // Revenue over time (daily) - using parameterized date handling
    let revenue;
    if (validFrom && validTo) {
      revenue = query(`SELECT date(created_at) as day, SUM(total) as revenue, COUNT(*) as orders FROM orders WHERE date(created_at) >= ? AND date(created_at) <= ? GROUP BY date(created_at) ORDER BY day`, [validFrom, validTo]);
    } else {
      revenue = query("SELECT date(created_at) as day, SUM(total) as revenue, COUNT(*) as orders FROM orders WHERE date(created_at) >= date('now', '-30 days') GROUP BY date(created_at) ORDER BY day");
    }

    // Orders by status
    const statusCounts = query('SELECT status, COUNT(*) as count FROM orders GROUP BY status');

    // Top items
    const allItems = query('SELECT items_json FROM orders');
    const itemCounts = {};
    allItems.forEach(o => {
      try {
        const items = JSON.parse(o.items_json);
        items.forEach(item => {
          itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
        });
      } catch(e) {}
    });
    const topItems = Object.entries(itemCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Orders by payment method
    const paymentMethods = query('SELECT payment_method, COUNT(*) as count FROM orders GROUP BY payment_method');

    // Orders by hour
    const hourlyOrders = query("SELECT strftime('%H', created_at) as hour, COUNT(*) as count FROM orders GROUP BY hour ORDER BY hour");

    // Revenue by category (approximate from items)
    const categoryRevenue = query(`
      SELECT c.name, SUM(o.total) as total
      FROM orders o
      JOIN categories c ON 1=1
      GROUP BY c.name
      ORDER BY total DESC
    `);

    // Summary
    const totals = query('SELECT SUM(total) as total_revenue, COUNT(*) as total_orders FROM orders');
    const avgOrder = query('SELECT AVG(total) as avg_value FROM orders');
    const mostOrdered = topItems[0] || { name: 'N/A' };
    const peakHour = hourlyOrders.sort((a, b) => b.count - a.count)[0] || { hour: 'N/A' };
    const topPayment = paymentMethods.sort((a, b) => b.count - a.count)[0] || { payment_method: 'N/A' };

    res.json({
      revenue,
      statusCounts,
      topItems,
      paymentMethods,
      hourlyOrders,
      categoryRevenue,
      summary: {
        total_revenue: totals[0]?.total_revenue || 0,
        total_orders: totals[0]?.total_orders || 0,
        avg_order_value: Math.round((avgOrder[0]?.avg_value || 0) * 100) / 100,
        most_ordered_item: mostOrdered.name,
        peak_hour: peakHour.hour ? `${peakHour.hour}:00` : 'N/A',
        top_payment_method: topPayment.payment_method,
      },
    });
  } catch (e) {
    console.error('Analytics error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

function getSettingsObj() {
  const rows = query('SELECT key, value FROM site_settings');
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);
  return settings;
}

module.exports = router;
