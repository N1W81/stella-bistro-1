const express = require('express');
const router = express.Router();
const { query, run } = require('../db/database');

// Helper to get site settings as object
function getSettings() {
  const rows = query('SELECT key, value FROM site_settings');
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);
  return settings;
}

// Helper to get opening hours
function getHours() {
  return query('SELECT * FROM opening_hours ORDER BY id');
}

// Helper to check if open now
function isOpenNow(hours) {
  const now = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = days[now.getDay()];
  const todayHours = hours.find(h => h.day_name === today);
  if (!todayHours || todayHours.is_closed) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [openH, openM] = todayHours.open_time.split(':').map(Number);
  const [closeH, closeM] = todayHours.close_time.split(':').map(Number);
  const openMinutes = openH * 60 + openM;
  let closeMinutes = closeH * 60 + closeM;

  // Handle midnight cross
  if (closeMinutes <= openMinutes) closeMinutes += 1440;

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

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

// Homepage
router.get('/', (req, res) => {
  try {
    const settings = getSettings();
    const hours = getHours();
    const openNow = isOpenNow(hours);

    const featured = query('SELECT * FROM menu_items WHERE is_featured = 1 AND visible = 1 LIMIT 4');
    featured.forEach(item => {
      item.display_price = computeDisplayPrice(item);
      try { item.tags = JSON.parse(item.tags); } catch(e) { item.tags = []; }
    });

    const testimonials = query('SELECT * FROM testimonials WHERE visible = 1 ORDER BY created_at DESC LIMIT 5');

    const upcomingEvents = query("SELECT * FROM events WHERE visible = 1 AND date >= date('now') ORDER BY date ASC LIMIT 3");

    const newsPosts = query('SELECT * FROM news_posts WHERE published = 1 ORDER BY date DESC LIMIT 3');

    const galleryImages = query('SELECT * FROM gallery_images ORDER BY display_order ASC, created_at DESC');

    res.render('index', {
      pageTitle: 'Stella Bistro — Karachi\'s Finest Bistro',
      settings,
      hours,
      openNow,
      featured,
      testimonials,
      upcomingEvents,
      newsPosts,
      galleryImages,
      path: '/',
    });
  } catch (e) {
    console.error('Homepage error:', e);
    res.status(500).send('Server error');
  }
});

// Menu page
router.get('/menu', (req, res) => {
  try {
    const settings = getSettings();
    const categories = query('SELECT * FROM categories WHERE visible = 1 ORDER BY display_order ASC');
    const items = query('SELECT * FROM menu_items WHERE visible = 1 ORDER BY display_order ASC, id ASC');

    items.forEach(item => {
      item.display_price = computeDisplayPrice(item);
      try { item.tags = JSON.parse(item.tags); } catch(e) { item.tags = []; }
    });

    // Group items by category
    const menuData = categories.map(cat => ({
      ...cat,
      items: items.filter(item => item.category_id === cat.id),
    }));

    res.render('menu', {
      pageTitle: 'Menu — Stella Bistro',
      settings,
      menuData,
      path: '/menu',
    });
  } catch (e) {
    console.error('Menu error:', e);
    res.status(500).send('Server error');
  }
});

// Checkout page
router.get('/checkout', (req, res) => {
  try {
    const settings = getSettings();
    // Get delivery cities
    const citiesStr = settings.delivery_cities || 'Karachi';
    const cities = citiesStr.split(',').map(c => c.trim()).filter(Boolean);

    res.render('checkout', {
      pageTitle: 'Checkout — Stella Bistro',
      settings,
      cities,
      path: '/checkout',
    });
  } catch (e) {
    console.error('Checkout error:', e);
    res.status(500).send('Server error');
  }
});

// Order confirmation
router.get('/order-confirmation/:orderNumber', (req, res) => {
  try {
    const settings = getSettings();
    const order = query('SELECT * FROM orders WHERE order_number = ?', [req.params.orderNumber]);

    if (!order || order.length === 0) {
      return res.status(404).render('NotFound', { pageTitle: 'Order Not Found', settings });
    }

    const o = order[0];
    try { o.items = JSON.parse(o.items_json); } catch(e) { o.items = []; }

    res.render('order-confirmation', {
      pageTitle: `Order ${o.order_number} — Stella Bistro`,
      settings,
      order: o,
      path: '/order-confirmation',
    });
  } catch (e) {
    console.error('Order confirmation error:', e);
    res.status(500).send('Server error');
  }
});

// Events page
router.get('/events', (req, res) => {
  try {
    const settings = getSettings();
    const page = parseInt(req.query.page) || 1;
    const perPage = 8;
    const offset = (page - 1) * perPage;

    const upcomingEvents = query("SELECT * FROM events WHERE visible = 1 AND date >= date('now') ORDER BY date ASC");
    const totalUpcoming = upcomingEvents.length;
    const paginatedEvents = upcomingEvents.slice(offset, offset + perPage);
    const totalPages = Math.ceil(totalUpcoming / perPage) || 1;

    const pastEvents = query("SELECT * FROM events WHERE visible = 1 AND date < date('now') ORDER BY date DESC LIMIT 10");

    res.render('events', {
      pageTitle: 'Events — Stella Bistro',
      settings,
      events: paginatedEvents,
      pastEvents,
      currentPage: page,
      totalPages,
      path: '/events',
    });
  } catch (e) {
    console.error('Events error:', e);
    res.status(500).send('Server error');
  }
});

// News page
router.get('/news', (req, res) => {
  try {
    const settings = getSettings();
    const page = parseInt(req.query.page) || 1;
    const perPage = 6;
    const offset = (page - 1) * perPage;

    const allPosts = query('SELECT * FROM news_posts WHERE published = 1 ORDER BY date DESC');
    const totalPosts = allPosts.length;
    const paginatedPosts = allPosts.slice(offset, offset + perPage);
    const totalPages = Math.ceil(totalPosts / perPage);

    res.render('news', {
      pageTitle: 'News — Stella Bistro',
      settings,
      posts: paginatedPosts,
      currentPage: page,
      totalPages,
      path: '/news',
    });
  } catch (e) {
    console.error('News error:', e);
    res.status(500).send('Server error');
  }
});

// Individual news post
router.get('/news/:slug', (req, res) => {
  try {
    const settings = getSettings();
    const posts = query('SELECT * FROM news_posts WHERE slug = ? AND published = 1', [req.params.slug]);

    if (!posts || posts.length === 0) {
      return res.status(404).render('NotFound', { pageTitle: 'Post Not Found', settings });
    }

    const post = posts[0];

    // Related posts
    let relatedPosts = [];
    if (post.category) {
      relatedPosts = query('SELECT * FROM news_posts WHERE published = 1 AND category = ? AND id != ? ORDER BY date DESC LIMIT 3', [post.category, post.id]);
    }
    if (relatedPosts.length < 3) {
      const recentPosts = query(`SELECT * FROM news_posts WHERE published = 1 AND id != ? ORDER BY date DESC LIMIT ${3 - relatedPosts.length}`, [post.id]);
      relatedPosts = [...relatedPosts, ...recentPosts].slice(0, 3);
    }

    res.render('news-post', {
      pageTitle: `${post.title} — Stella Bistro`,
      settings,
      post,
      relatedPosts,
      path: '/news',
    });
  } catch (e) {
    console.error('News post error:', e);
    res.status(500).send('Server error');
  }
});

module.exports = router;
