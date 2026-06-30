// Stella Bistro — Menu Page JavaScript

let currentFilter = 'all';
let currentSearch = '';

function scrollToCategory(categoryId) {
  const section = document.getElementById(`category-${categoryId}`);
  if (section) {
    const offset = 140;
    const top = section.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  // Update active tab
  document.querySelectorAll('.menu-tab').forEach(tab => {
    tab.classList.remove('menu-tab--active');
    if (parseInt(tab.dataset.category) === categoryId) {
      tab.classList.add('menu-tab--active');
      // Scroll tab into view
      tab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  });
}

function setFilter(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.filter-chip').forEach(chip => chip.classList.remove('filter-chip--active'));
  if (btn) btn.classList.add('filter-chip--active');
  filterMenu();
}

function filterMenu() {
  const searchInput = document.getElementById('menuSearch');
  currentSearch = searchInput ? searchInput.value.toLowerCase().trim() : '';

  const items = document.querySelectorAll('.menu-item');
  let visibleCount = 0;

  items.forEach(item => {
    const name = item.dataset.name || '';
    const desc = item.dataset.desc || '';
    const tags = item.dataset.tags ? JSON.parse(item.dataset.tags) : [];

    // Search match
    let searchMatch = true;
    if (currentSearch) {
      searchMatch = name.includes(currentSearch) || desc.includes(currentSearch);
    }

    // Filter match
    let filterMatch = true;
    if (currentFilter !== 'all') {
      filterMatch = tags.some(t => t.includes(currentFilter));
    }

    const show = searchMatch && filterMatch;
    item.style.display = show ? '' : 'none';
    if (show) visibleCount++;
  });

  // Show/hide category sections based on visible items
  document.querySelectorAll('.menu-section').forEach(section => {
    const visibleItems = section.querySelectorAll('.menu-item[style*="display: block"], .menu-item:not([style*="display: none"])');
    section.style.display = visibleItems.length > 0 ? '' : 'none';
  });

  // No results message
  const noResults = document.getElementById('noResults');
  if (noResults) {
    noResults.style.display = visibleCount === 0 ? 'block' : 'none';
  }
}

// Scroll spy for category tabs
function initScrollSpy() {
  const sections = document.querySelectorAll('.menu-section');
  const tabs = document.querySelectorAll('.menu-tab');

  if (sections.length === 0 || tabs.length === 0) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.dataset.category;
        tabs.forEach(tab => {
          tab.classList.remove('menu-tab--active');
          if (parseInt(tab.dataset.category) === parseInt(id)) {
            tab.classList.add('menu-tab--active');
            // Scroll tab into view in the tab bar
            const tabBar = document.querySelector('.menu-tabs__inner');
            if (tabBar) {
              tab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }
          }
        });
      }
    });
  }, { threshold: 0.2, rootMargin: '-80px 0px 0px 0px' });

  sections.forEach(section => observer.observe(section));
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  initScrollSpy();

  // Activate first tab on load
  const firstTab = document.querySelector('.menu-tab');
  if (firstTab) firstTab.classList.add('menu-tab--active');
});
