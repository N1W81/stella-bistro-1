// Stella Bistro — Main JavaScript

document.addEventListener('DOMContentLoaded', () => {

  // ─── Navbar scroll effect ───
  const navbar = document.getElementById('navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        navbar.classList.add('navbar--scrolled');
      } else {
        navbar.classList.remove('navbar--scrolled');
      }
    });
  }

  // ─── Announcement bar dismiss ───
  window.dismissAnnouncement = function() {
    const bar = document.getElementById('announcementBar');
    if (bar) {
      bar.style.display = 'none';
      try { localStorage.setItem('stella_announcement_dismissed', '1'); } catch(e) {}
    }
  };

  // Auto-dismiss if previously dismissed
  try {
    if (localStorage.getItem('stella_announcement_dismissed') === '1') {
      const bar = document.getElementById('announcementBar');
      if (bar) bar.style.display = 'none';
    }
  } catch(e) {}

  // ─── Mobile nav overlay ───
  const hamburger = document.getElementById('hamburger');
  const navOverlay = document.getElementById('navOverlay');
  const navOverlayClose = document.getElementById('navOverlayClose');

  if (hamburger && navOverlay) {
    hamburger.addEventListener('click', () => {
      navOverlay.classList.add('nav-overlay--open');
      document.body.style.overflow = 'hidden';
    });
    if (navOverlayClose) {
      navOverlayClose.addEventListener('click', () => {
        navOverlay.classList.remove('nav-overlay--open');
        document.body.style.overflow = '';
      });
    }
    navOverlay.querySelectorAll('.nav-overlay__link').forEach(link => {
      link.addEventListener('click', () => {
        navOverlay.classList.remove('nav-overlay--open');
        document.body.style.overflow = '';
      });
    });
  }

  // ─── Cart sidebar toggle ───
  const cartToggle = document.getElementById('cartToggle');
  const cartSidebar = document.getElementById('cartSidebar');
  const cartClose = document.getElementById('cartClose');
  const cartOverlay = document.getElementById('cartOverlay');

  if (cartToggle && cartSidebar) {
    cartToggle.addEventListener('click', (e) => {
      e.preventDefault();
      cartSidebar.classList.add('cart-sidebar--open');
      document.body.style.overflow = 'hidden';
    });
    function closeCart() {
      cartSidebar.classList.remove('cart-sidebar--open');
      document.body.style.overflow = '';
    }
    if (cartClose) cartClose.addEventListener('click', closeCart);
    if (cartOverlay) cartOverlay.addEventListener('click', closeCart);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && cartSidebar.classList.contains('cart-sidebar--open')) {
        closeCart();
      }
    });
  }

  // ─── Fade-in on scroll (Intersection Observer) ───
  const fadeElements = document.querySelectorAll('.fade-in');
  if (fadeElements.length > 0 && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('fade-in--visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    fadeElements.forEach(el => observer.observe(el));
  }

  // ─── Lightbox ───
  let lightboxImages = [];
  let currentLightboxIndex = 0;

  window.openLightbox = function(src, caption) {
    const lightbox = document.getElementById('lightbox');
    const img = document.getElementById('lightboxImg');
    const cap = document.getElementById('lightboxCaption');
    if (!lightbox || !img) return;

    // Find all gallery images for navigation
    const galleryItems = document.querySelectorAll('.gallery__item');
    lightboxImages = [];
    galleryItems.forEach((item, idx) => {
      const imgs = item.querySelector('img');
      const caps = item.querySelector('.gallery__caption');
      if (imgs) {
        lightboxImages.push({ src: imgs.src, caption: caps ? caps.textContent : '' });
        if (imgs.src === src || item.querySelector(`[src="${src}"]`)) {
          currentLightboxIndex = idx;
        }
      }
    });

    img.src = src;
    if (cap) cap.textContent = caption || '';
    lightbox.classList.add('lightbox--open');
    document.body.style.overflow = 'hidden';
  };

  window.closeLightbox = function(e) {
    if (e && e.target !== document.getElementById('lightboxImg') && e.target !== document.getElementById('lightboxCaption')) {
      // Only close if clicking overlay
    }
    // Always close on X or escape
    const lightbox = document.getElementById('lightbox');
    if (lightbox) {
      lightbox.classList.remove('lightbox--open');
      document.body.style.overflow = '';
    }
  };

  window.navigateLightbox = function(dir) {
    currentLightboxIndex += dir;
    if (currentLightboxIndex < 0) currentLightboxIndex = lightboxImages.length - 1;
    if (currentLightboxIndex >= lightboxImages.length) currentLightboxIndex = 0;
    const img = document.getElementById('lightboxImg');
    const cap = document.getElementById('lightboxCaption');
    if (img && lightboxImages[currentLightboxIndex]) {
      img.src = lightboxImages[currentLightboxIndex].src;
      if (cap) cap.textContent = lightboxImages[currentLightboxIndex].caption;
    }
  };

  // Lightbox keyboard navigation
  document.addEventListener('keydown', (e) => {
    const lightbox = document.getElementById('lightbox');
    if (!lightbox || !lightbox.classList.contains('lightbox--open')) return;
    if (e.key === 'Escape') {
      lightbox.classList.remove('lightbox--open');
      document.body.style.overflow = '';
    }
    if (e.key === 'ArrowLeft') navigateLightbox(-1);
    if (e.key === 'ArrowRight') navigateLightbox(1);
  });

  // Lightbox overlay click
  document.getElementById('lightbox')?.addEventListener('click', function(e) {
    if (e.target === this) {
      this.classList.remove('lightbox--open');
      document.body.style.overflow = '';
    }
  });

  // ─── "Open Now" indicator ───
  const timingsTable = document.querySelector('.timings__table');
  if (timingsTable) {
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const now = new Date();
    const today = days[now.getDay()];
    const rows = timingsTable.querySelectorAll('.timings__row');
    rows.forEach(row => {
      const dayEl = row.querySelector('.timings__day');
      if (dayEl && dayEl.textContent.trim() === today) {
        dayEl.style.color = 'var(--gold)';
      }
    });
  }

  console.log('Stella Bistro — Site initialized');
});

// ─── Resize handler for mobile menu ───
window.addEventListener('resize', () => {
  const navOverlay = document.getElementById('navOverlay');
  if (navOverlay && window.innerWidth > 768) {
    navOverlay.classList.remove('nav-overlay--open');
    document.body.style.overflow = '';
  }
});
