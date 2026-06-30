// Stella Bistro — Admin Main JavaScript

document.addEventListener('DOMContentLoaded', () => {
  // Sidebar toggle
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('adminSidebar');
  const sidebarClose = document.getElementById('sidebarClose');

  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('admin-sidebar--open');
    });
  }

  if (sidebarClose && sidebar) {
    sidebarClose.addEventListener('click', () => {
      sidebar.classList.remove('admin-sidebar--open');
    });
  }

  // Close sidebar on link click (mobile)
  if (sidebar) {
    sidebar.querySelectorAll('.admin-sidebar__link').forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 1023) {
          sidebar.classList.remove('admin-sidebar--open');
        }
      });
    });
  }

  // Close sidebar on outside click
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 1023 && sidebar && sidebar.classList.contains('admin-sidebar--open')) {
      if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
        sidebar.classList.remove('admin-sidebar--open');
      }
    }
  });

  // Flash message auto-hide
  document.querySelectorAll('.flash').forEach(el => {
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.5s ease';
      setTimeout(() => el.remove(), 500);
    }, 4000);
  });

  // Copy text helper
  window.copyText = function(text) {
    navigator.clipboard.writeText(text).then(() => {
      const btn = event?.target;
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = orig, 2000);
      }
    }).catch(() => {});
  };
});
