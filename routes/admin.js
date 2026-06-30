const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query, run } = require('../db/database');
const { isAuthenticated, redirectIfAuthenticated } = require('../middleware/auth');

// ─── Multer Config ───
const createUploader = (subfolder) => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'public', 'uploads', subfolder)),
    filename: (req, file, cb) => cb(null, `${subfolder}_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.]/g, '_')}`),
  });
  return multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      if (allowed.includes(file.mimetype)) cb(null, true);
      else cb(new Error('Only jpg, png, webp allowed'));
    },
  });
};

const dishUpload = createUploader('dishes');
const eventUpload = createUploader('events');
const newsUpload = createUploader('news');
const galleryUpload = createUploader('gallery');
const heroUpload = createUploader('hero');
const aboutUpload = createUploader('about');

// ─── Helpers ───
function getSettings() {
  const rows = query('SELECT key, value FROM site_settings');
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);
  return settings;
}

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

const SALT_ROUNDS = 12;

// ─── Auth Routes ───
router.get('/', redirectIfAuthenticated, (req, res) => {
  const settings = getSettings();
  res.render('admin/login', { pageTitle: 'Admin Login', settings, registrationOpen: settings.registration_open === '1' });
});

router.post('/login', (req, res) => {
  const { username, password, remember } = req.body;
  if (!username || !password) {
    req.flash('error_msg', 'Username and password required');
    return res.redirect('/stella-control');
  }

  const admins = query('SELECT * FROM admins WHERE username = ?', [username]);
  if (admins.length === 0) {
    req.flash('error_msg', 'Invalid credentials');
    return res.redirect('/stella-control');
  }

  const admin = admins[0];
  const match = bcrypt.compareSync(password, admin.password_hash);
  if (!match) {
    req.flash('error_msg', 'Invalid credentials');
    return res.redirect('/stella-control');
  }

  req.session.adminId = admin.id;
  req.session.adminUsername = admin.username;

  if (remember) {
    req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
  }

  run('UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [admin.id]);
  res.redirect('/stella-control/dashboard');
});

router.post('/register', (req, res) => {
  const settings = getSettings();
  if (settings.registration_open !== '1') {
    req.flash('error_msg', 'Registration is closed');
    return res.redirect('/stella-control');
  }

  const { username, password, confirm_password, secret_key } = req.body;
  if (!username || !password || !confirm_password || !secret_key) {
    req.flash('error_msg', 'All fields required');
    return res.redirect('/stella-control');
  }

  if (password !== confirm_password) {
    req.flash('error_msg', 'Passwords do not match');
    return res.redirect('/stella-control');
  }

  if (secret_key !== process.env.ADMIN_SECRET_KEY) {
    req.flash('error_msg', 'Invalid secret key');
    return res.redirect('/stella-control');
  }

  const existing = query('SELECT id FROM admins WHERE username = ?', [username]);
  if (existing.length > 0) {
    req.flash('error_msg', 'Username already taken');
    return res.redirect('/stella-control');
  }

  const hash = bcrypt.hashSync(password, SALT_ROUNDS);
  run('INSERT INTO admins (username, password_hash) VALUES (?, ?)', [username, hash]);

  req.flash('success_msg', 'Account created! Please login.');
  res.redirect('/stella-control');
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/stella-control');
});

// ─── All admin routes below require auth ───
router.use(isAuthenticated);

// ─── Dashboard ───
router.get('/dashboard', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const ordersToday = query(`SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as revenue FROM orders WHERE date(created_at) = '${today}'`);
  const pendingOrders = query("SELECT COUNT(*) as count FROM orders WHERE status = 'pending'");
  const weekRevenue = query(`SELECT COALESCE(SUM(total), 0) as revenue FROM orders WHERE created_at >= date('now', '-7 days')`);
  const totalItems = query('SELECT COUNT(*) as count FROM menu_items');
  const upcomingEvents = query("SELECT COUNT(*) as count FROM events WHERE date >= date('now') AND visible = 1");
  const newReservations = query("SELECT COUNT(*) as count FROM reservations WHERE created_at >= datetime('now', '-24 hours')");

  const recentOrders = query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 10");
  const recentReservations = query("SELECT * FROM reservations ORDER BY created_at DESC LIMIT 5");

  res.render('admin/dashboard', {
    pageTitle: 'Dashboard',
    adminUsername: req.session.adminUsername,
    ordersToday: ordersToday[0],
    pendingOrders: pendingOrders[0],
    weekRevenue: weekRevenue[0],
    totalItems: totalItems[0],
    upcomingEvents: upcomingEvents[0],
    newReservations: newReservations[0],
    recentOrders,
    recentReservations,
  });
});

// ─── Orders ───
router.get('/orders', (req, res) => {
  const status = req.query.status || '';
  const search = req.query.search || '';
  const from = req.query.from || '';
  const to = req.query.to || '';

  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params = [];

  if (status && status !== 'all') {
    if (status === 'today') {
      sql += " AND date(created_at) = date('now')";
    } else if (status === 'week') {
      sql += " AND created_at >= date('now', '-7 days')";
    } else {
      sql += ' AND status = ?';
      params.push(status);
    }
  }

  if (search) {
    sql += ' AND (order_number LIKE ? OR customer_name LIKE ? OR customer_phone LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  if (from) {
    sql += ' AND date(created_at) >= ?';
    params.push(from);
  }

  if (to) {
    sql += ' AND date(created_at) <= ?';
    params.push(to);
  }

  sql += ' ORDER BY created_at DESC';

  const orders = query(sql, params);

  // Parse items_json for each order
  orders.forEach(o => {
    try { o.items = JSON.parse(o.items_json); } catch(e) { o.items = []; }
  });

  const todayStats = query("SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as revenue FROM orders WHERE date(created_at) = date('now')");
  const pendingStat = query("SELECT COUNT(*) as count FROM orders WHERE status = 'pending'");
  const deliveredStat = query("SELECT COUNT(*) as count FROM orders WHERE status = 'completed'");

  res.render('admin/orders', {
    pageTitle: 'Orders',
    adminUsername: req.session.adminUsername,
    orders,
    todayStats: todayStats[0],
    pendingStat: pendingStat[0],
    deliveredStat: deliveredStat[0],
    currentStatus: status,
    search,
    from,
    to,
  });
});

// PATCH order status
router.post('/orders/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, cancellation_reason } = req.body;
  const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  run('UPDATE orders SET status = ?, cancellation_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, cancellation_reason || null, id]);

  // Broadcast update
  if (req.app.broadcastOrder) {
    const updatedOrder = query('SELECT * FROM orders WHERE id = ?', [id]);
    if (updatedOrder.length > 0) {
      req.app.broadcastOrder({ type: 'order_updated', order: updatedOrder[0] });
    }
  }

  if (req.xhr || req.headers.accept?.includes('json')) {
    return res.json({ success: true });
  }
  res.redirect('/stella-control/orders');
});

// Update payment verification
router.post('/orders/:id/verify-payment', (req, res) => {
  const { id } = req.params;
  const { verified } = req.body;
  run('UPDATE orders SET payment_verified = ? WHERE id = ?', [verified ? 1 : 0, id]);
  res.json({ success: true });
});

// Update admin notes
router.post('/orders/:id/notes', (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;
  run('UPDATE orders SET admin_notes = ? WHERE id = ?', [notes, id]);
  res.json({ success: true });
});

// Export CSV
router.get('/orders/export', (req, res) => {
  const orders = query('SELECT * FROM orders ORDER BY created_at DESC');
  let csv = 'Order#,Customer,Phone,Address,Items,Subtotal,Delivery,Fee,Promo Discount,Total,Payment Method,Transaction ID,Payment Verified,Status,Created At\n';

  orders.forEach(o => {
    let items = '';
    try {
      const parsed = JSON.parse(o.items_json);
      items = parsed.map(i => `${i.name}x${i.quantity}`).join('; ');
    } catch(e) {}

    csv += `"${o.order_number}","${o.customer_name}","${o.customer_phone}","${o.delivery_address}","${items}",${o.subtotal},${o.delivery_fee},${o.promo_discount || 0},${o.total},"${o.payment_method}","${o.transaction_id || ''}",${o.payment_verified},"${o.status}","${o.created_at}"\n`;
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=orders.csv');
  res.send(csv);
});

// ─── Menu Manager ───
router.get('/menu', (req, res) => {
  const categories = query('SELECT * FROM categories ORDER BY display_order ASC');
  const items = query('SELECT * FROM menu_items ORDER BY display_order ASC, id ASC');

  items.forEach(item => {
    try { item.tags = JSON.parse(item.tags); } catch(e) { item.tags = []; }
    item.display_price = computeDisplayPrice(item);
  });

  const menuData = categories.map(cat => ({
    ...cat,
    items: items.filter(item => item.category_id === cat.id),
  }));

  res.render('admin/menu', { pageTitle: 'Menu Manager', adminUsername: req.session.adminUsername, menuData, categories });
});

// Add category
router.post('/menu/category/add', (req, res) => {
  const { name } = req.body;
  if (name) {
    const maxOrder = query('SELECT MAX(display_order) as m FROM categories');
    const order = (maxOrder[0]?.m || 0) + 1;
    run('INSERT INTO categories (name, display_order) VALUES (?, ?)', [name, order]);
  }
  res.redirect('/stella-control/menu');
});

// Update category
router.post('/menu/category/update', (req, res) => {
  const { id, name, display_order } = req.body;
  if (name) run('UPDATE categories SET name = ?, display_order = ? WHERE id = ?', [name, parseInt(display_order) || 0, id]);
  res.redirect('/stella-control/menu');
});

// Delete category
router.post('/menu/category/delete', (req, res) => {
  run('DELETE FROM categories WHERE id = ?', [req.body.id]);
  res.redirect('/stella-control/menu');
});

// Add menu item
router.post('/menu/item/add', dishUpload.single('image'), (req, res) => {
  const { name, description, category_id, base_price, original_price, tags, kitchen_notes, display_order } = req.body;
  if (!name || !category_id || !base_price) {
    req.flash('error_msg', 'Name, category, and price required');
    return res.redirect('/stella-control/menu');
  }

  const imagePath = req.file ? `/uploads/dishes/${req.file.filename}` : null;
  const tagsArr = tags ? (Array.isArray(tags) ? tags : [tags]) : [];

  run(`INSERT INTO menu_items (category_id, name, description, base_price, original_price, image_path, tags, kitchen_notes, display_order, display_price)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [category_id, name, description || '', parseFloat(base_price), parseFloat(original_price || base_price), imagePath, JSON.stringify(tagsArr), kitchen_notes || '', parseInt(display_order) || 0, parseFloat(base_price)]
  );

  res.redirect('/stella-control/menu');
});

// Update menu item
router.post('/menu/item/update/:id', dishUpload.single('image'), (req, res) => {
  const { id } = req.params;
  const { name, description, category_id, base_price, original_price, discount_enabled, discount_type, discount_value, tags, is_new, available, visible, kitchen_notes, display_order, remove_image } = req.body;

  const item = query('SELECT * FROM menu_items WHERE id = ?', [id]);
  if (item.length === 0) return res.redirect('/stella-control/menu');

  const current = item[0];
  const newImage = req.file ? `/uploads/dishes/${req.file.filename}` : (remove_image ? null : current.image_path);

  // Delete old image if replaced
  if (req.file && current.image_path) {
    const oldPath = path.join(__dirname, '..', 'public', current.image_path);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  const tagsArr = tags ? (Array.isArray(tags) ? tags : [tags]) : [];

  run(`UPDATE menu_items SET name=?, description=?, category_id=?, base_price=?, original_price=?, discount_enabled=?, discount_type=?, discount_value=?, image_path=?, tags=?, is_new=?, available=?, visible=?, kitchen_notes=?, display_order=? WHERE id=?`,
    [name, description || '', category_id || current.category_id, parseFloat(base_price) || current.base_price, parseFloat(original_price || base_price) || current.original_price, discount_enabled ? 1 : 0, discount_type || 'percentage', parseFloat(discount_value) || 0, newImage, JSON.stringify(tagsArr), is_new ? 1 : 0, available ? 1 : 0, visible !== undefined ? (visible ? 1 : 0) : current.visible, kitchen_notes || '', parseInt(display_order) || 0, id]
  );

  // Recalculate display price
  const updated = query('SELECT * FROM menu_items WHERE id = ?', [id]);
  if (updated.length > 0) {
    const u = updated[0];
    const dp = computeDisplayPrice(u);
    run('UPDATE menu_items SET display_price = ? WHERE id = ?', [dp, id]);
  }

  res.redirect('/stella-control/menu');
});

// Delete menu item
router.post('/menu/item/delete/:id', (req, res) => {
  const item = query('SELECT * FROM menu_items WHERE id = ?', [req.params.id]);
  if (item.length > 0 && item[0].image_path) {
    const imgPath = path.join(__dirname, '..', 'public', item[0].image_path);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }
  run('DELETE FROM menu_items WHERE id = ?', [req.params.id]);
  if (req.xhr) return res.json({ success: true });
  res.redirect('/stella-control/menu');
});

// Duplicate menu item
router.post('/menu/item/duplicate/:id', (req, res) => {
  const item = query('SELECT * FROM menu_items WHERE id = ?', [req.params.id]);
  if (item.length === 0) return res.redirect('/stella-control/menu');
  const i = item[0];
  run(`INSERT INTO menu_items (category_id, name, description, base_price, original_price, discount_enabled, discount_type, discount_value, display_price, image_path, tags, is_featured, is_new, available, kitchen_notes, display_order, visible)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [i.category_id, `Copy of ${i.name}`, i.description, i.base_price, i.original_price, i.discount_enabled, i.discount_type, i.discount_value, i.display_price, i.image_path, i.tags, 0, 0, i.available, i.kitchen_notes, (i.display_order || 0) + 1, i.visible]
  );
  res.redirect('/stella-control/menu');
});

// Toggle menu item visibility
router.post('/menu/item/toggle/:id', (req, res) => {
  const item = query('SELECT * FROM menu_items WHERE id = ?', [req.params.id]);
  if (item.length > 0) {
    run('UPDATE menu_items SET visible = ? WHERE id = ?', [item[0].visible ? 0 : 1, req.params.id]);
  }
  if (req.xhr) return res.json({ success: true });
  res.redirect('/stella-control/menu');
});

// ─── Pricing ───
router.get('/pricing', (req, res) => {
  const categories = query('SELECT * FROM categories ORDER BY display_order ASC');
  const items = query('SELECT * FROM menu_items ORDER BY category_id, display_order ASC');

  items.forEach(item => {
    item.display_price = computeDisplayPrice(item);
  });

  const menuData = categories.map(cat => ({
    ...cat,
    items: items.filter(item => item.category_id === cat.id),
  }));

  res.render('admin/pricing', { pageTitle: 'Pricing & Discounts', adminUsername: req.session.adminUsername, menuData });
});

// Bulk update pricing
router.post('/pricing/bulk-update', (req, res) => {
  const { items } = req.body;
  if (items && Array.isArray(items)) {
    items.forEach(item => {
      run(`UPDATE menu_items SET base_price=?, original_price=?, discount_enabled=?, discount_type=?, discount_value=? WHERE id=?`,
        [parseFloat(item.base_price) || 0, parseFloat(item.original_price || item.base_price) || 0, item.discount_enabled ? 1 : 0, item.discount_type || 'percentage', parseFloat(item.discount_value) || 0, item.id]
      );
      const updated = query('SELECT * FROM menu_items WHERE id = ?', [item.id]);
      if (updated.length > 0) {
        const dp = computeDisplayPrice(updated[0]);
        run('UPDATE menu_items SET display_price = ? WHERE id = ?', [dp, item.id]);
      }
    });
  }
  res.json({ success: true });
});

// Bulk category discount
router.post('/pricing/category-discount', (req, res) => {
  const { category_id, discount_type, discount_value } = req.body;
  if (category_id) {
    run(`UPDATE menu_items SET discount_enabled = 1, discount_type = ?, discount_value = ? WHERE category_id = ?`,
      [discount_type || 'percentage', parseFloat(discount_value) || 0, category_id]);

    const items = query('SELECT * FROM menu_items WHERE category_id = ?', [category_id]);
    items.forEach(item => {
      const dp = computeDisplayPrice(item);
      run('UPDATE menu_items SET display_price = ? WHERE id = ?', [dp, item.id]);
    });
  }
  res.json({ success: true });
});

// Remove all discounts
router.post('/pricing/remove-all', (req, res) => {
  run('UPDATE menu_items SET discount_enabled = 0, discount_value = 0, display_price = base_price');
  res.json({ success: true });
});

// ─── Promo Codes ───
router.get('/promos', (req, res) => {
  const promos = query('SELECT * FROM promo_codes ORDER BY created_at DESC');
  res.render('admin/promos', { pageTitle: 'Promo Codes', adminUsername: req.session.adminUsername, promos });
});

router.post('/promos/add', (req, res) => {
  const { code, discount_type, discount_value, min_order, expiry_date, usage_limit, active } = req.body;
  if (!code || !discount_type || !discount_value) {
    req.flash('error_msg', 'Code, type, and value required');
    return res.redirect('/stella-control/promos');
  }
  run(`INSERT INTO promo_codes (code, discount_type, discount_value, min_order, expiry_date, usage_limit, active)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [code.toUpperCase().replace(/\\s/g, ''), discount_type, parseFloat(discount_value), parseFloat(min_order || 0), expiry_date || null, usage_limit ? parseInt(usage_limit) : null, active ? 1 : 0]
  );
  res.redirect('/stella-control/promos');
});

router.post('/promos/delete/:id', (req, res) => {
  run('DELETE FROM promo_codes WHERE id = ?', [req.params.id]);
  res.redirect('/stella-control/promos');
});

// ─── Featured Dishes ───
router.get('/featured', (req, res) => {
  const items = query('SELECT * FROM menu_items ORDER BY is_featured DESC, display_order ASC, id ASC');
  const featured = items.filter(i => i.is_featured);
  const available = items.filter(i => !i.is_featured);
  res.render('admin/featured', { pageTitle: 'Featured Dishes', adminUsername: req.session.adminUsername, featured, available });
});

router.post('/featured/update', (req, res) => {
  const { featured_ids } = req.body;
  run('UPDATE menu_items SET is_featured = 0');
  const ids = featured_ids ? (Array.isArray(featured_ids) ? featured_ids : [featured_ids]) : [];
  ids.forEach(id => {
    run('UPDATE menu_items SET is_featured = 1 WHERE id = ?', [id]);
  });
  res.redirect('/stella-control/featured');
});

// ─── Events ───
router.get('/events', (req, res) => {
  const events = query('SELECT * FROM events ORDER BY date DESC');
  res.render('admin/events', { pageTitle: 'Events', adminUsername: req.session.adminUsername, events });
});

router.post('/events/add', eventUpload.single('image'), (req, res) => {
  const { title, date, time, description, visible } = req.body;
  if (!title || !date) {
    req.flash('error_msg', 'Title and date required');
    return res.redirect('/stella-control/events');
  }
  const imagePath = req.file ? `/uploads/events/${req.file.filename}` : null;
  run('INSERT INTO events (title, date, time, description, image_path, visible) VALUES (?, ?, ?, ?, ?, ?)',
    [title, date, time || null, description || '', imagePath, visible ? 1 : 0]);
  res.redirect('/stella-control/events');
});

router.post('/events/update/:id', eventUpload.single('image'), (req, res) => {
  const { id } = req.params;
  const { title, date, time, description, visible, remove_image } = req.body;
  const event = query('SELECT * FROM events WHERE id = ?', [id]);
  if (event.length === 0) return res.redirect('/stella-control/events');

  const newImage = req.file ? `/uploads/events/${req.file.filename}` : (remove_image ? null : event[0].image_path);
  if (req.file && event[0].image_path) {
    const oldPath = path.join(__dirname, '..', 'public', event[0].image_path);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  run('UPDATE events SET title=?, date=?, time=?, description=?, image_path=?, visible=? WHERE id=?',
    [title, date, time || null, description || '', newImage, visible ? 1 : 0, id]);
  res.redirect('/stella-control/events');
});

router.post('/events/delete/:id', (req, res) => {
  const event = query('SELECT * FROM events WHERE id = ?', [req.params.id]);
  if (event.length > 0 && event[0].image_path) {
    const imgPath = path.join(__dirname, '..', 'public', event[0].image_path);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }
  run('DELETE FROM events WHERE id = ?', [req.params.id]);
  res.redirect('/stella-control/events');
});

// ─── News Manager ───
router.get('/news', (req, res) => {
  const posts = query('SELECT * FROM news_posts ORDER BY created_at DESC');
  res.render('admin/news', { pageTitle: 'News Manager', adminUsername: req.session.adminUsername, posts });
});

router.post('/news/add', newsUpload.single('thumbnail'), (req, res) => {
  const { title, slug, author, category, date, excerpt, body, published } = req.body;
  if (!title) {
    req.flash('error_msg', 'Title required');
    return res.redirect('/stella-control/news');
  }
  const finalSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const thumbPath = req.file ? `/uploads/news/${req.file.filename}` : null;

  run('INSERT INTO news_posts (title, slug, author, category, date, excerpt, body, thumbnail, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [title, finalSlug, author || 'Stella Bistro', category || null, date || new Date().toISOString().split('T')[0], excerpt || '', body || '', thumbPath, published ? 1 : 0]);
  res.redirect('/stella-control/news');
});

router.post('/news/update/:id', newsUpload.single('thumbnail'), (req, res) => {
  const { id } = req.params;
  const { title, slug, author, category, date, excerpt, body, published, remove_thumbnail } = req.body;
  const post = query('SELECT * FROM news_posts WHERE id = ?', [id]);
  if (post.length === 0) return res.redirect('/stella-control/news');

  const newThumb = req.file ? `/uploads/news/${req.file.filename}` : (remove_thumbnail ? null : post[0].thumbnail);
  if (req.file && post[0].thumbnail) {
    const oldPath = path.join(__dirname, '..', 'public', post[0].thumbnail);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  const finalSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  run('UPDATE news_posts SET title=?, slug=?, author=?, category=?, date=?, excerpt=?, body=?, thumbnail=?, published=? WHERE id=?',
    [title, finalSlug, author || 'Stella Bistro', category || null, date || new Date().toISOString().split('T')[0], excerpt || '', body || '', newThumb, published ? 1 : 0, id]);
  res.redirect('/stella-control/news');
});

router.post('/news/delete/:id', (req, res) => {
  const post = query('SELECT * FROM news_posts WHERE id = ?', [req.params.id]);
  if (post.length > 0 && post[0].thumbnail) {
    const thumbPath = path.join(__dirname, '..', 'public', post[0].thumbnail);
    if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
  }
  run('DELETE FROM news_posts WHERE id = ?', [req.params.id]);
  res.redirect('/stella-control/news');
});

// ─── Gallery ───
router.get('/gallery', (req, res) => {
  const images = query('SELECT * FROM gallery_images ORDER BY display_order ASC, created_at DESC');
  res.render('admin/gallery', { pageTitle: 'Gallery', adminUsername: req.session.adminUsername, images });
});

router.post('/gallery/upload', galleryUpload.array('images', 20), (req, res) => {
  if (req.files && req.files.length > 0) {
    const maxOrder = query('SELECT MAX(display_order) as m FROM gallery_images');
    let order = (maxOrder[0]?.m || 0) + 1;
    req.files.forEach(file => {
      run('INSERT INTO gallery_images (path, display_order) VALUES (?, ?)', [`/uploads/gallery/${file.filename}`, order++]);
    });
  }
  res.redirect('/stella-control/gallery');
});

router.post('/gallery/update/:id', (req, res) => {
  const { caption, display_order } = req.body;
  run('UPDATE gallery_images SET caption=?, display_order=? WHERE id=?', [caption || '', parseInt(display_order) || 0, req.params.id]);
  res.redirect('/stella-control/gallery');
});

router.post('/gallery/delete/:id', (req, res) => {
  const img = query('SELECT * FROM gallery_images WHERE id = ?', [req.params.id]);
  if (img.length > 0 && img[0].path) {
    const imgPath = path.join(__dirname, '..', 'public', img[0].path);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }
  run('DELETE FROM gallery_images WHERE id = ?', [req.params.id]);
  res.redirect('/stella-control/gallery');
});

// ─── Homepage Content ───
router.get('/homepage', (req, res) => {
  const settings = getSettings();
  res.render('admin/homepage', { pageTitle: 'Homepage Content', adminUsername: req.session.adminUsername, settings });
});

router.post('/homepage/save', heroUpload.fields([
  { name: 'hero_image', maxCount: 1 },
  { name: 'about_image', maxCount: 1 },
]), (req, res) => {
  const fields = [
    'hero_tagline', 'about_text', 'pull_quote', 'signature_text',
    'announcement_bar_enabled', 'announcement_bar_text',
    'ticker_enabled', 'ticker_text',
    'feature_1_icon', 'feature_1_title', 'feature_1_desc',
    'feature_2_icon', 'feature_2_title', 'feature_2_desc',
    'feature_3_icon', 'feature_3_title', 'feature_3_desc',
    'feature_4_icon', 'feature_4_title', 'feature_4_desc',
  ];

  fields.forEach(field => {
    if (req.body[field] !== undefined) {
      run('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)', [field, req.body[field]]);
    }
  });

  if (req.files?.hero_image?.[0]) {
    run('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)', ['hero_image', `/uploads/hero/${req.files.hero_image[0].filename}`]);
  }
  if (req.files?.about_image?.[0]) {
    run('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)', ['about_image', `/uploads/about/${req.files.about_image[0].filename}`]);
  }

  res.redirect('/stella-control/homepage');
});

// ─── Location & Contact ───
router.get('/location', (req, res) => {
  const settings = getSettings();
  res.render('admin/location', { pageTitle: 'Location & Contact', adminUsername: req.session.adminUsername, settings });
});

router.post('/location/save', (req, res) => {
  const fields = ['address', 'phone', 'whatsapp_number', 'email', 'maps_embed_url', 'maps_directions_url', 'instagram_url', 'facebook_url', 'delivery_cities'];
  fields.forEach(field => {
    if (req.body[field] !== undefined) {
      run('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)', [field, req.body[field]]);
    }
  });
  res.redirect('/stella-control/location');
});

// ─── Opening Hours ───
router.get('/hours', (req, res) => {
  const hours = query('SELECT * FROM opening_hours ORDER BY id');
  res.render('admin/hours', { pageTitle: 'Opening Hours', adminUsername: req.session.adminUsername, hours });
});

router.post('/hours/save', (req, res) => {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  days.forEach((day, idx) => {
    const id = idx + 1;
    const openTime = req.body[`open_${id}`] || '09:00';
    const closeTime = req.body[`close_${id}`] || '22:00';
    const isClosed = req.body[`closed_${id}`] ? 1 : 0;
    run('UPDATE opening_hours SET open_time = ?, close_time = ?, is_closed = ? WHERE id = ?', [openTime, closeTime, isClosed, id]);
  });
  res.redirect('/stella-control/hours');
});

// ─── Reservations ───
router.get('/reservations', (req, res) => {
  const status = req.query.status || '';
  const date = req.query.date || '';
  let sql = 'SELECT * FROM reservations WHERE 1=1';
  const params = [];

  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (date) { sql += ' AND date = ?'; params.push(date); }

  sql += ' ORDER BY created_at DESC';
  const reservations = query(sql, params);

  res.render('admin/reservations', { pageTitle: 'Reservations', adminUsername: req.session.adminUsername, reservations, status, date });
});

router.post('/reservations/update/:id', (req, res) => {
  const { status, admin_notes } = req.body;
  run('UPDATE reservations SET status=?, admin_notes=? WHERE id=?', [status || 'pending', admin_notes || null, req.params.id]);
  res.redirect('/stella-control/reservations');
});

router.get('/reservations/export', (req, res) => {
  const reservations = query('SELECT * FROM reservations ORDER BY date DESC');
  let csv = '#,Date,Time,Name,Phone,Email,Guests,Occasion,Requests,Status,Admin Notes,Created At\n';
  reservations.forEach(r => {
    csv += `${r.id},"${r.date}","${r.time}","${r.name}","${r.phone}","${r.email || ''}",${r.guests},"${r.occasion || ''}","${r.special_requests || ''}","${r.status}","${r.admin_notes || ''}","${r.created_at}"\n`;
  });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=reservations.csv');
  res.send(csv);
});

// ─── Payment Settings ───
router.get('/payment', (req, res) => {
  const settings = getSettings();
  res.render('admin/payment', { pageTitle: 'Payment Settings', adminUsername: req.session.adminUsername, settings });
});

router.post('/payment/save', (req, res) => {
  const fields = [
    'jazzcash_number', 'jazzcash_name', 'jazzcash_enabled',
    'easypaisa_number', 'easypaisa_name', 'easypaisa_enabled',
    'meezan_details', 'meezan_enabled',
    'hbl_details', 'hbl_enabled',
    'cod_enabled', 'cod_max_amount',
    'delivery_fee', 'free_delivery_above', 'min_order', 'estimated_delivery_time', 'order_whatsapp_number',
  ];
  fields.forEach(field => {
    if (req.body[field] !== undefined) {
      run('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)', [field, req.body[field]]);
    }
  });
  res.redirect('/stella-control/payment');
});

// ─── Announcements ───
router.get('/announcements', (req, res) => {
  const settings = getSettings();
  res.render('admin/announcements', { pageTitle: 'Announcements', adminUsername: req.session.adminUsername, settings });
});

router.post('/announcements/save', (req, res) => {
  const fields = ['announcement_bar_enabled', 'announcement_bar_text', 'announcement_bar_color',
    'popup_enabled', 'popup_title', 'popup_body', 'popup_button_text', 'popup_button_link', 'popup_expiry'];
  fields.forEach(field => {
    if (req.body[field] !== undefined) {
      run('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)', [field, req.body[field]]);
    }
  });
  res.redirect('/stella-control/announcements');
});

// ─── Testimonials ───
router.get('/testimonials', (req, res) => {
  const testimonials = query('SELECT * FROM testimonials ORDER BY created_at DESC');
  res.render('admin/testimonials', { pageTitle: 'Testimonials', adminUsername: req.session.adminUsername, testimonials });
});

router.post('/testimonials/add', (req, res) => {
  const { reviewer_name, rating, review_text, review_date, visible } = req.body;
  if (!reviewer_name || !review_text) {
    req.flash('error_msg', 'Name and review text required');
    return res.redirect('/stella-control/testimonials');
  }
  run('INSERT INTO testimonials (reviewer_name, rating, review_text, review_date, visible) VALUES (?, ?, ?, ?, ?)',
    [reviewer_name, parseInt(rating) || 5, review_text, review_date || new Date().toISOString().split('T')[0], visible ? 1 : 0]);
  res.redirect('/stella-control/testimonials');
});

router.post('/testimonials/update/:id', (req, res) => {
  const { reviewer_name, rating, review_text, review_date, visible } = req.body;
  run('UPDATE testimonials SET reviewer_name=?, rating=?, review_text=?, review_date=?, visible=? WHERE id=?',
    [reviewer_name, parseInt(rating) || 5, review_text, review_date || new Date().toISOString().split('T')[0], visible ? 1 : 0, req.params.id]);
  res.redirect('/stella-control/testimonials');
});

router.post('/testimonials/delete/:id', (req, res) => {
  run('DELETE FROM testimonials WHERE id = ?', [req.params.id]);
  res.redirect('/stella-control/testimonials');
});

// ─── Settings ───
router.get('/settings', (req, res) => {
  const settings = getSettings();
  const admins = query('SELECT id, username, created_at, last_login FROM admins ORDER BY created_at ASC');
  res.render('admin/settings', { pageTitle: 'Settings', adminUsername: req.session.adminUsername, settings, admins });
});

router.post('/settings/update', (req, res) => {
  const { site_name, meta_description, registration_open, admin_secret_key } = req.body;
  run('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)', ['site_name', site_name || 'Stella Bistro']);
  run('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)', ['meta_description', meta_description || '']);
  run('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)', ['registration_open', registration_open ? '1' : '0']);

  if (admin_secret_key) {
    // Note: in production, would update .env. Here we store in DB for simplicity
    run('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)', ['admin_secret_key', admin_secret_key]);
  }

  res.redirect('/stella-control/settings');
});

router.post('/settings/change-password', (req, res) => {
  const { current_password, new_password, confirm_password } = req.body;
  if (!current_password || !new_password || !confirm_password) {
    req.flash('error_msg', 'All password fields required');
    return res.redirect('/stella-control/settings');
  }

  if (new_password !== confirm_password) {
    req.flash('error_msg', 'Passwords do not match');
    return res.redirect('/stella-control/settings');
  }

  const admins = query('SELECT * FROM admins WHERE id = ?', [req.session.adminId]);
  if (admins.length === 0 || !bcrypt.compareSync(current_password, admins[0].password_hash)) {
    req.flash('error_msg', 'Current password is incorrect');
    return res.redirect('/stella-control/settings');
  }

  const hash = bcrypt.hashSync(new_password, SALT_ROUNDS);
  run('UPDATE admins SET password_hash = ? WHERE id = ?', [hash, req.session.adminId]);
  req.flash('success_msg', 'Password changed successfully');
  res.redirect('/stella-control/settings');
});

router.post('/settings/delete-admin/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (id === req.session.adminId) {
    req.flash('error_msg', 'Cannot delete your own account');
    return res.redirect('/stella-control/settings');
  }
  run('DELETE FROM admins WHERE id = ?', [id]);
  res.redirect('/stella-control/settings');
});

// Danger zone
router.post('/settings/clear-orders', (req, res) => {
  run('DELETE FROM orders');
  res.json({ success: true, message: 'All orders cleared' });
});

router.post('/settings/reset-defaults', (req, res) => {
  // Clear all dynamic data but keep admins
  run('DELETE FROM menu_items');
  run('DELETE FROM categories');
  run('DELETE FROM orders');
  run('DELETE FROM promo_codes');
  run('DELETE FROM reservations');
  run('DELETE FROM events');
  run('DELETE FROM news_posts');
  run('DELETE FROM gallery_images');
  run('DELETE FROM opening_hours');
  run('DELETE FROM testimonials');
  run('DELETE FROM site_settings');

  // Re-seed will happen on next app restart
  res.json({ success: true, message: 'Database reset. Restart server to re-seed.' });
});

// Save custom CSS
router.post('/settings/save-css', (req, res) => {
  const { custom_css } = req.body;
  run('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)', ['custom_css', custom_css || '']);
  res.redirect('/stella-control/settings');
});

module.exports = router;
