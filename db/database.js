const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'stella.db');
let db = null;

async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA journal_mode=WAL');
  db.run('PRAGMA foreign_keys=ON');

  createTables();
  seedData();

  return db;
}

let saveTimeout = null;

function saveDb() {
  if (!db) return;
  // Debounce: batch writes to avoid disk thrashing
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_PATH, buffer);
      console.log('Database saved to disk');
    } catch (e) {
      console.error('Save error:', e.message);
    }
    saveTimeout = null;
  }, 300);
}

function saveNow() {
  if (!db) return;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = null;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (e) {
    console.error('Save error:', e.message);
  }
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      display_order INTEGER DEFAULT 0,
      visible INTEGER DEFAULT 1
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      base_price REAL NOT NULL,
      original_price REAL,
      discount_enabled INTEGER DEFAULT 0,
      discount_type TEXT DEFAULT 'percentage',
      discount_value REAL DEFAULT 0,
      display_price REAL,
      image_path TEXT,
      tags TEXT DEFAULT '[]',
      is_featured INTEGER DEFAULT 0,
      featured_description TEXT,
      featured_image_path TEXT,
      is_new INTEGER DEFAULT 0,
      available INTEGER DEFAULT 1,
      kitchen_notes TEXT,
      display_order INTEGER DEFAULT 0,
      visible INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      delivery_address TEXT NOT NULL,
      landmark TEXT,
      city TEXT,
      special_instructions TEXT,
      payment_method TEXT NOT NULL,
      transaction_id TEXT,
      payment_screenshot TEXT,
      payment_verified INTEGER DEFAULT 0,
      promo_code TEXT,
      promo_discount REAL DEFAULT 0,
      items_json TEXT NOT NULL,
      subtotal REAL NOT NULL,
      delivery_fee REAL NOT NULL,
      total REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      cancellation_reason TEXT,
      admin_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS promo_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      discount_type TEXT NOT NULL,
      discount_value REAL NOT NULL,
      min_order REAL DEFAULT 0,
      expiry_date DATE,
      usage_limit INTEGER,
      times_used INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      date DATE NOT NULL,
      time TEXT NOT NULL,
      guests INTEGER NOT NULL,
      occasion TEXT,
      special_requests TEXT,
      status TEXT DEFAULT 'pending',
      admin_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      date DATE NOT NULL,
      time TEXT,
      description TEXT,
      image_path TEXT,
      visible INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS news_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      author TEXT DEFAULT 'Stella Bistro',
      category TEXT,
      date DATE,
      excerpt TEXT,
      body TEXT,
      thumbnail TEXT,
      published INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS gallery_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL,
      caption TEXT,
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS opening_hours (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_name TEXT NOT NULL,
      open_time TEXT,
      close_time TEXT,
      is_closed INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS testimonials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reviewer_name TEXT NOT NULL,
      rating INTEGER DEFAULT 5,
      review_text TEXT NOT NULL,
      review_date DATE,
      visible INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  saveNow();
}

function seedData() {
  const catCount = db.exec('SELECT COUNT(*) as c FROM categories');
  if (catCount.length > 0 && catCount[0].values[0][0] > 0) return;

  // Seed categories
  const categories = [
    { name: 'Starters', display_order: 1 },
    { name: 'Soups', display_order: 2 },
    { name: 'Burgers', display_order: 3 },
    { name: 'Pizza', display_order: 4 },
    { name: 'Sandwiches', display_order: 5 },
    { name: 'Chicken Steaks', display_order: 6 },
    { name: 'Chinese', display_order: 7 },
    { name: 'Rice', display_order: 8 },
    { name: 'Bar BQ', display_order: 9 },
    { name: 'Karahi and Handi', display_order: 10 },
    { name: 'Pasta', display_order: 11 },
    { name: 'Tandoor', display_order: 12 },
    { name: 'Salad', display_order: 13 },
    { name: 'Mojito', display_order: 14 },
    { name: 'Shakes', display_order: 15 },
    { name: 'Coffee', display_order: 16 },
    { name: 'Mocktails', display_order: 17 },
  ];

  const stmt = db.prepare('INSERT INTO categories (name, display_order) VALUES (?, ?)');
  categories.forEach(c => stmt.run([c.name, c.display_order]));
  stmt.free();

  // Seed menu items
  const items = [
    // Starters (cat 1)
    { cat: 1, name: 'Plain Fries', desc: '250g fries served with ketchup', base: 321.75, orig: 429, tags: '[]' },
    { cat: 1, name: 'Masala Fries', desc: '250g fries with special masala', base: 336.75, orig: 449, tags: '["Spicy 🌶"]' },
    { cat: 1, name: 'Garlic Fries', desc: '250g fries with mayo garlic sauce', base: 359.25, orig: 479, tags: '["Vegetarian 🌱"]' },
    { cat: 1, name: 'Cheese Fries', desc: '6mm fries with cheese sauce', base: 411.75, orig: 549, tags: '["Vegetarian 🌱"]' },
    { cat: 1, name: 'Chicken Cheesy Strips', desc: '6 pieces wings with special buffalo sauce', base: 674.25, orig: 899, tags: '["Spicy 🌶"]' },

    // Soups (cat 2)
    { cat: 2, name: 'Corn Soup', desc: 'Hot stock cooked in traditional Chinese style', base: 262.50, orig: 350, tags: '["Vegetarian 🌱"]' },
    { cat: 2, name: 'Hot & Sour Soup', desc: 'For spicy lovers, sour & hot taste', base: 300, orig: 400, tags: '["Spicy 🌶"]' },

    // Burgers (cat 3)
    { cat: 3, name: 'Stella Special Burger', desc: 'Two stuffed beef patties, potato bun & fries', base: 1199.25, orig: 1599, tags: '["Chef\'s Special ⭐","Bestseller 🔥"]', featured: 1, is_new: 1 },
    { cat: 3, name: 'Classic Beef Burger', desc: 'Beef patty in bun with fresh vegetables', base: 824.25, orig: 1099, tags: '[]' },
    { cat: 3, name: 'Smash Beef Burger', desc: 'Smashed beef patty, potato bun, homemade sauce', base: 899.25, orig: 1199, tags: '["Bestseller 🔥"]' },
    { cat: 3, name: 'Stella Signature Chicken Burger', desc: 'Stuffed chicken, potato bun & fries', base: 824.25, orig: 1099, tags: '["Chef\'s Special ⭐"]' },
    { cat: 3, name: 'Special Crispy Burger', desc: 'Crispy patty, burger bun, special sauce', base: 637.50, orig: 850, tags: '[]' },
    { cat: 3, name: 'Crispy Chicken Burger', desc: 'Marinated crispy patty, signature sauce', base: 562.50, orig: 750, tags: '[]' },

    // Pizza (cat 4)
    { cat: 4, name: 'Signature Supreme Pizza', desc: 'Beef & chicken with homemade pizza sauce', base: 1124.25, orig: 1499, tags: '["Chef\'s Special ⭐"]' },

    // Sandwiches (cat 5)
    { cat: 5, name: 'Stella Signature Sandwich', desc: 'Bread stuffed with chicken, cheese, egg & chef\'s sauce', base: 936.75, orig: 1249, tags: '["Chef\'s Special ⭐"]' },
    { cat: 5, name: 'Grilled Chicken Sandwich', desc: 'Smoky chicken with lettuce & cucumber', base: 824.25, orig: 1099, tags: '[]' },
    { cat: 5, name: 'BBQ Sandwich', desc: 'Roasted chicken, crunch vegetables', base: 824.25, orig: 1099, tags: '[]' },
    { cat: 5, name: 'Malai Boti Sandwich', desc: 'Grilled chicken with special sauce', base: 899.25, orig: 1189, tags: '["Spicy 🌶"]' },

    // Chicken Steaks (cat 6)
    { cat: 6, name: 'Tarragon Chicken Steak', desc: 'Grilled chicken, sautéed vegetables, choice of side', base: 1161.75, orig: 1549, tags: '[]' },
    { cat: 6, name: 'Moroccan Chicken Steak', desc: 'Chicken with sautéed vegetables, choice of side', base: 1161.75, orig: 1549, tags: '["Spicy 🌶"]' },
    { cat: 6, name: 'Chicken Angry Steak', desc: 'Crumb chicken, sauce, cheese & special marinade', base: 1499.25, orig: 1999, tags: '["Spicy 🌶","Bestseller 🔥"]' },
    { cat: 6, name: 'Italian Chicken Steak', desc: 'Chicken, sautéed vegetables & Italian sauce', base: 1236.75, orig: 1649, tags: '[]' },
    { cat: 6, name: 'Mushroom Chicken Steak', desc: 'Chicken with mushroom sauce & sautéed vegetables', base: 1199.25, orig: 1599, tags: '[]' },

    // Chinese (cat 7)
    { cat: 7, name: 'Beef Chilli Dry', desc: 'Beef Chilli Dry', base: 1199.25, orig: 1599, tags: '["Spicy 🌶"]' },
    { cat: 7, name: 'Chicken Chilli Dry', desc: 'Chicken Chilli Dry', base: 1094.25, orig: 1399, tags: '["Spicy 🌶"]' },
    { cat: 7, name: 'Chicken Manchurian', desc: 'Chicken Manchurian', base: 1094.25, orig: 1459, tags: '[]' },
    { cat: 7, name: 'Schezwan Chicken', desc: 'Schezwan Chicken', base: 1094.25, orig: 1459, tags: '["Spicy 🌶"]' },
    { cat: 7, name: 'Vegetables Chow Mein', desc: 'Vegetables Chow Mein', base: 749.25, orig: 999, tags: '["Vegetarian 🌱"]' },
    { cat: 7, name: 'Chicken Chow Mein', desc: 'Chicken Chow Mein', base: 936.75, orig: 1249, tags: '[]' },
    { cat: 7, name: 'Chicken Shashlik', desc: 'Chicken Shashlik', base: 1094.25, orig: 1459, tags: '["Spicy 🌶"]' },

    // Rice (cat 8)
    { cat: 8, name: 'Vegetables Fried Rice', desc: 'Vegetables Fried Rice', base: 337.50, orig: 450, tags: '["Vegetarian 🌱"]' },
    { cat: 8, name: 'Chicken Fried Rice', desc: 'Chicken Fried Rice', base: 450, orig: 500, tags: '[]' },
    { cat: 8, name: 'Chinese Fried Rice', desc: 'Chinese Fried Rice', base: 337.50, orig: 450, tags: '[]' },

    // Bar BQ (cat 9)
    { cat: 9, name: 'Bihari Chicken Leg Tikka', desc: 'Bihari Chicken Leg Tikka', base: 524.25, orig: 699, tags: '["Spicy 🌶"]' },
    { cat: 9, name: 'Bihari Chicken Breast Tikka', desc: 'Bihari Chicken Breast Tikka', base: 599.25, orig: 799, tags: '[]' },
    { cat: 9, name: 'Malai Tikka', desc: 'Malai Tikka', base: 599.25, orig: 799, tags: '[]' },
    { cat: 9, name: 'Bihari Chicken Boti', desc: 'Bihari Chicken Boti', base: 636.75, orig: 849, tags: '["Spicy 🌶"]' },
    { cat: 9, name: 'Chicken Malai Boti', desc: 'Chicken Malai Boti', base: 636.75, orig: 849, tags: '[]' },
    { cat: 9, name: 'Bihari Beef Boti', desc: 'Bihari Beef Boti', base: 936.75, orig: 1249, tags: '["Spicy 🌶"]' },
    { cat: 9, name: 'Dhaga Kabab', desc: 'Dhaga Kabab', base: 899.25, orig: 1199, tags: '[]' },
    { cat: 9, name: 'Chandan Kabab', desc: 'Chandan Kabab', base: 899.25, orig: 1199, tags: '[]' },
    { cat: 9, name: 'Gola Kabab', desc: 'Gola Kabab', base: 936.75, orig: 1249, tags: '["Bestseller 🔥"]' },
    { cat: 9, name: 'Cheese Kabab', desc: 'Cheese Kabab', base: 749.25, orig: 999, tags: '[]' },

    // Karahi and Handi (cat 10)
    { cat: 10, name: 'Chicken Karahi', desc: 'Chicken Karahi', base: 1124.25, orig: 1499, tags: '["Spicy 🌶","Bestseller 🔥"]' },
    { cat: 10, name: 'Koyla Karahi', desc: 'Koyla Karahi', base: 1161.75, orig: 1549, tags: '["Spicy 🌶"]' },
    { cat: 10, name: 'White Karahi', desc: 'White Karahi', base: 1124.25, orig: 1499, tags: '[]' },
    { cat: 10, name: 'Shinwari Chicken Karahi', desc: 'Shinwari Chicken Karahi', base: 1124.25, orig: 1499, tags: '["Spicy 🌶"]' },
    { cat: 10, name: 'Peshawari Karahi', desc: 'Peshawari Karahi', base: 1124.25, orig: 1459, tags: '["Spicy 🌶"]' },
    { cat: 10, name: 'Shinwari Mutton Karahi', desc: 'Shinwari Mutton Karahi', base: 1874.25, orig: 2499, tags: '["Chef\'s Special ⭐"]' },
    { cat: 10, name: 'Makhni Handi', desc: 'Makhni Handi', base: 1161.75, orig: 1549, tags: '[]' },
    { cat: 10, name: 'Paneer Handi', desc: 'Paneer Handi', base: 1424.25, orig: 1899, tags: '["Vegetarian 🌱"]' },
    { cat: 10, name: 'Reshmi Handi', desc: 'Reshmi Handi', base: 1161.75, orig: 1549, tags: '[]' },

    // Pasta (cat 11)
    { cat: 11, name: 'Stella Special Pasta', desc: 'Spicy white sauce, sundried tomato & chicken', base: 899.25, orig: 1189, tags: '["Chef\'s Special ⭐","Spicy 🌶"]' },
    { cat: 11, name: 'Alfredo Pasta', desc: 'Grilled chicken in alfredo sauce', base: 824.25, orig: 1099, tags: '[]' },
    { cat: 11, name: 'Bolognese Pasta', desc: 'Vegetables, cheese & beef pasta', base: 1088.75, orig: 1449, tags: '[]' },

    // Tandoor (cat 12)
    { cat: 12, name: 'Garlic Naan', desc: 'Garlic Naan', base: 59.25, orig: 79, tags: '["Vegetarian 🌱"]' },
    { cat: 12, name: 'Rogni Naan', desc: 'Rogni Naan', base: 74.25, orig: 99, tags: '["Vegetarian 🌱"]' },
    { cat: 12, name: 'Plain Naan', desc: 'Plain Naan', base: 29.25, orig: 39, tags: '["Vegetarian 🌱"]' },
    { cat: 12, name: 'Chapati', desc: 'Chapati', base: 25.50, orig: 34, tags: '["Vegetarian 🌱"]' },
    { cat: 12, name: 'Paratha', desc: 'Paratha', base: 90, orig: 120, tags: '["Vegetarian 🌱"]' },

    // Salad (cat 13)
    { cat: 13, name: 'Stella Signature Salad', desc: 'Cucumber, lettuce, cheese, tomato, shrimp & egg', base: 636.75, orig: 849, tags: '["Chef\'s Special ⭐"]' },

    // Mojito (cat 14)
    { cat: 14, name: 'Strawberry Mojito', desc: 'Strawberry Mojito', base: 524.25, orig: 699, tags: '["Vegetarian 🌱"]' },
    { cat: 14, name: 'Mango Mojito', desc: 'Mango Mojito', base: 524.25, orig: 699, tags: '["Vegetarian 🌱"]' },
    { cat: 14, name: 'Mint Mojito', desc: 'Mint Mojito', base: 524.25, orig: 699, tags: '["Vegetarian 🌱","Bestseller 🔥"]' },
    { cat: 14, name: 'Pomegranate Mojito', desc: 'Pomegranate Mojito', base: 524.25, orig: 699, tags: '["Vegetarian 🌱"]' },

    // Shakes (cat 15)
    { cat: 15, name: 'Oreo Shake', desc: 'Blended ice cream with chocolate sandwich cookies', base: 674.25, orig: 899, tags: '["Vegetarian 🌱","Bestseller 🔥"]' },
    { cat: 15, name: 'Butterscotch Shake', desc: 'Butterscotch Shake', base: 561.75, orig: 749, tags: '["Vegetarian 🌱"]' },
    { cat: 15, name: 'Mango Shake', desc: 'Mango Shake', base: 524.25, orig: 699, tags: '["Vegetarian 🌱"]' },
    { cat: 15, name: 'Strawberry Shake', desc: 'Strawberry Shake', base: 524.25, orig: 699, tags: '["Vegetarian 🌱"]' },
    { cat: 15, name: 'Pista Shake', desc: 'Pista Shake', base: 524.25, orig: 699, tags: '["Vegetarian 🌱"]' },
    { cat: 15, name: 'Kulfa Shake', desc: 'Kulfa Shake', base: 524.25, orig: 699, tags: '["Vegetarian 🌱"]' },

    // Coffee (cat 16)
    { cat: 16, name: 'Cold Coffee', desc: 'Cold Coffee', base: 599.25, orig: 799, tags: '["Vegetarian 🌱"]' },
    { cat: 16, name: 'Tea', desc: 'Brewed herbal beverage, comforting & aromatic', base: 186.75, orig: 249, tags: '["Vegetarian 🌱"]' },

    // Mocktails (cat 17)
    { cat: 17, name: 'Luckys Special Mocktail', desc: 'Luckys Special Mocktail', base: 749.25, orig: 999, tags: '["Vegetarian 🌱","Chef\'s Special ⭐"]' },
    { cat: 17, name: 'Coconut Cooler', desc: 'Coconut Cooler', base: 486.75, orig: 649, tags: '["Vegetarian 🌱"]' },
    { cat: 17, name: 'Coconut Blue Cooler', desc: 'Coconut Blue Cooler', base: 486.75, orig: 649, tags: '["Vegetarian 🌱"]' },
    { cat: 17, name: 'Rainbow Star Mocktail', desc: 'Rainbow Star Mocktail', base: 749.25, orig: 999, tags: '["Vegetarian 🌱"]' },
    { cat: 17, name: 'Mint Margarita', desc: 'Mint Margarita', base: 411.75, orig: 549, tags: '["Vegetarian 🌱"]' },
    { cat: 17, name: 'Blue Margarita', desc: 'Blue Margarita', base: 411.75, orig: 549, tags: '["Vegetarian 🌱"]' },
    { cat: 17, name: 'Blackberry Mocktail', desc: 'Blackberry Mocktail', base: 449.25, orig: 599, tags: '["Vegetarian 🌱"]' },
    { cat: 17, name: 'Pineapple Mocktail', desc: 'Pineapple Mocktail', base: 449.25, orig: 599, tags: '["Vegetarian 🌱"]' },
    { cat: 17, name: 'Fresh Lime', desc: 'Fresh Lime', base: 261.75, orig: 349, tags: '["Vegetarian 🌱"]' },
    { cat: 17, name: 'Peach Mocktail', desc: 'Peach Mocktail', base: 449.25, orig: 599, tags: '["Vegetarian 🌱"]' },
  ];

  const itemStmt = db.prepare(`INSERT INTO menu_items (category_id, name, description, base_price, original_price, tags, is_featured, is_new, display_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  // First insert first 4 as featured
  items.forEach((item, idx) => {
    const displayPrice = item.base;
    itemStmt.run([item.cat, item.name, item.desc, item.base, item.orig, item.tags, idx < 4 ? 1 : 0, item.is_new || 0, displayPrice]);
  });
  itemStmt.free();

  // Seed opening hours
  const hours = [
    { day: 'Monday', open: '12:00', close: '23:30', closed: 0 },
    { day: 'Tuesday', open: '12:00', close: '23:30', closed: 0 },
    { day: 'Wednesday', open: '12:00', close: '23:30', closed: 0 },
    { day: 'Thursday', open: '12:00', close: '23:30', closed: 0 },
    { day: 'Friday', open: '12:00', close: '00:00', closed: 0 },
    { day: 'Saturday', open: '11:00', close: '00:00', closed: 0 },
    { day: 'Sunday', open: '11:00', close: '23:00', closed: 0 },
  ];

  const hoursStmt = db.prepare('INSERT INTO opening_hours (day_name, open_time, close_time, is_closed) VALUES (?, ?, ?, ?)');
  hours.forEach(h => hoursStmt.run([h.day, h.open, h.close, h.closed]));
  hoursStmt.free();

  // Seed site settings
  const settings = [
    ['hero_tagline', 'Where Every Plate Tells a Story'],
    ['about_text', 'Stella Bistro was born from a passion for exceptional food and intimate dining. Located in the heart of Karachi, we blend bold desi flavors with international finesse. From our Bar BQ to our signature pastas, every dish is crafted with care.'],
    ['pull_quote', 'Food is the language we all speak.'],
    ['signature_text', '— The Stella Team'],
    ['announcement_bar_enabled', '0'],
    ['announcement_bar_text', ''],
    ['ticker_enabled', '0'],
    ['ticker_text', ''],
    ['instagram_url', 'https://www.instagram.com/stellabistro.pk/'],
    ['facebook_url', '#'],
    ['whatsapp_number', '923000000000'],
    ['phone', '+92 300 0000000'],
    ['email', 'hello@stellabistro.com'],
    ['address', '📍 Stella Bistro, Karachi, Pakistan'],
    ['maps_embed_url', 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d462563.0321237309!2d66.800641821723!3d25.19320156422887!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3eb33e06651d4bbf%3A0x9cf92f44555a0c23!2sKarachi%2C%20Pakistan!5e0!3m2!1sen!2s!4v1710000000000'],
    ['maps_directions_url', 'https://maps.google.com/?q=Karachi,Pakistan'],
    ['delivery_fee', '100'],
    ['free_delivery_above', '0'],
    ['min_order', '500'],
    ['estimated_delivery_time', '30–45 minutes'],
    ['order_whatsapp_number', '923000000000'],
    ['registration_open', '1'],
    ['jazzcash_number', '03XX-XXXXXXX'],
    ['jazzcash_name', 'Stella Bistro'],
    ['jazzcash_enabled', '1'],
    ['easypaisa_number', '03XX-XXXXXXX'],
    ['easypaisa_name', 'Stella Bistro'],
    ['easypaisa_enabled', '1'],
    ['meezan_details', 'Account: Stella Bistro\nAccount No: XXXX-XXXX-XXXXXXXXXX\nIBAN: PKXXXXXXXXXXXX'],
    ['meezan_enabled', '1'],
    ['hbl_details', 'Bank: HBL\nAccount: Stella Bistro\nAccount No: XXXX-XXXX-XXXXXXXXXX\nIBAN: PKXXXXXXXXXXXX'],
    ['hbl_enabled', '1'],
    ['cod_enabled', '1'],
    ['cod_max_amount', '0'],
    ['meta_description', 'Stella Bistro — Karachi\'s finest bistro. Order online, explore our menu.'],
    ['site_name', 'Stella Bistro'],
    ['delivery_cities', 'Karachi'],
    ['feature_1_icon', 'flame'],
    ['feature_1_title', 'Fresh Ingredients'],
    ['feature_1_desc', 'Every dish made with hand-selected, quality ingredients'],
    ['feature_2_icon', 'star'],
    ['feature_2_title', 'Signature Recipes'],
    ['feature_2_desc', 'Unique recipes crafted by our expert chefs'],
    ['feature_3_icon', 'truck'],
    ['feature_3_title', 'Fast Delivery'],
    ['feature_3_desc', 'Hot food at your door in 30–45 minutes'],
    ['feature_4_icon', 'shield'],
    ['feature_4_title', '100% Halal'],
    ['feature_4_desc', 'All our ingredients are certified halal'],
  ];

  const settingsStmt = db.prepare('INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)');
  settings.forEach(s => settingsStmt.run(s));
  settingsStmt.free();

  // Seed testimonials
  const testimonials = [
    { name: 'Ahmed K.', rating: 5, text: 'Best food in Karachi! The Stella Special Burger is out of this world. Delivery was fast and everything was piping hot.', date: '2025-01-10' },
    { name: 'Fatima R.', rating: 5, text: 'The Karahi and Handi section is incredible. Shinwari Chicken Karahi reminds me of Peshawar. Will order again!', date: '2025-01-15' },
    { name: 'Usman T.', rating: 5, text: 'Ordered for a family gathering. Everyone loved it. The Bar BQ platter was phenomenal. Highly recommend!', date: '2025-01-20' },
  ];

  const testStmt = db.prepare('INSERT INTO testimonials (reviewer_name, rating, review_text, review_date) VALUES (?, ?, ?, ?)');
  testimonials.forEach(t => testStmt.run([t.name, t.rating, t.text, t.date]));
  testStmt.free();

  saveNow();
}

function query(sql, params = []) {
  if (!db) return [];
  try {
    const stmt = db.prepare(sql);
    const results = stmt.getAsObject(params);
    stmt.free();
    return results;
  } catch (e) {
    console.error('Query error:', sql, e.message);
    return [];
  }
}

function run(sql, params = []) {
  if (!db) return { changes: 0 };
  try {
    db.run(sql, params);
    saveDb();
    const lastId = db.exec('SELECT last_insert_rowid() as id');
    const id = lastId.length > 0 ? lastId[0].values[0][0] : 0;
    return { changes: db.getRowsModified(), lastInsertRowid: id };
  } catch (e) {
    console.error('Run error:', sql, e.message);
    return { changes: 0, error: e.message };
  }
}

module.exports = { getDb, saveDb, saveNow, query, run };
