// Stella Bistro — Admin Analytics JavaScript (Chart.js)

let charts = {};

function loadAnalytics() {
  const dateRange = document.getElementById('dateRange')?.value || '30';
  const dateFrom = document.getElementById('dateFrom')?.value || '';
  const dateTo = document.getElementById('dateTo')?.value || '';

  // Handle custom date range
  if (dateRange === 'custom') {
    document.getElementById('dateFrom').style.display = '';
    document.getElementById('dateTo').style.display = '';
    if (!dateFrom || !dateTo) return;
  } else {
    document.getElementById('dateFrom').style.display = 'none';
    document.getElementById('dateTo').style.display = 'none';
  }

  // Calculate date range
  let from = dateFrom;
  let to = dateTo;
  if (dateRange !== 'custom') {
    const days = parseInt(dateRange) || 30;
    const d = new Date();
    to = d.toISOString().split('T')[0];
    d.setDate(d.getDate() - days);
    from = d.toISOString().split('T')[0];
  }

  // Destroy existing charts
  Object.values(charts).forEach(chart => {
    if (chart) chart.destroy();
  });
  charts = {};

  // Fetch analytics data
  fetch(`/api/analytics?from=${from}&to=${to}`)
    .then(r => r.json())
    .then(data => {
      renderSummary(data.summary);
      renderRevenueChart(data.revenue);
      renderStatusChart(data.statusCounts);
      renderTopItemsChart(data.topItems);
      renderPaymentChart(data.paymentMethods);
      renderHourlyChart(data.hourlyOrders);
      renderCategoryChart(data.categoryRevenue);
    })
    .catch(err => console.error('Analytics load error:', err));
}

function renderSummary(summary) {
  const container = document.getElementById('analyticsSummary');
  if (!container || !summary) return;

  container.innerHTML = `
    <div class="stat-card"><div class="stat-card__value">Rs. ${Math.round(summary.total_revenue || 0).toLocaleString()}</div><div class="stat-card__label">Total Revenue</div></div>
    <div class="stat-card"><div class="stat-card__value">${summary.total_orders || 0}</div><div class="stat-card__label">Total Orders</div></div>
    <div class="stat-card"><div class="stat-card__value">Rs. ${Math.round(summary.avg_order_value || 0)}</div><div class="stat-card__label">Avg Order Value</div></div>
    <div class="stat-card"><div class="stat-card__value">${summary.most_ordered_item || 'N/A'}</div><div class="stat-card__label">Most Ordered</div></div>
    <div class="stat-card"><div class="stat-card__value">${summary.peak_hour || 'N/A'}</div><div class="stat-card__label">Peak Hour</div></div>
    <div class="stat-card"><div class="stat-card__value">${summary.top_payment_method || 'N/A'}</div><div class="stat-card__label">Top Payment</div></div>
  `;
}

function renderRevenueChart(revenue) {
  const ctx = document.getElementById('revenueChart')?.getContext('2d');
  if (!ctx) return;

  const labels = revenue.map(r => r.day || r.day?.substring(5) || '');
  const values = revenue.map(r => parseFloat(r.revenue) || 0);
  const orderCounts = revenue.map(r => parseInt(r.orders) || 0);

  charts.revenue = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Revenue (Rs.)',
          data: values,
          borderColor: '#C9A84C',
          backgroundColor: 'rgba(201,168,76,0.1)',
          fill: true,
          tension: 0.3,
          yAxisID: 'y'
        },
        {
          label: 'Orders',
          data: orderCounts,
          borderColor: '#DC143C',
          backgroundColor: 'rgba(220,20,60,0.1)',
          fill: true,
          tension: 0.3,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#9E9E9E' } }
      },
      scales: {
        x: { ticks: { color: '#9E9E9E', maxTicksLimit: 10 } },
        y: { ticks: { color: '#9E9E9E' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y1: { position: 'right', ticks: { color: '#9E9E9E' }, grid: { display: false } }
      }
    }
  });
}

function renderStatusChart(statusCounts) {
  const ctx = document.getElementById('statusChart')?.getContext('2d');
  if (!ctx) return;

  const statusMap = { pending: '#DC143C', in_progress: '#F39C12', completed: '#2ECC71', cancelled: '#9E9E9E' };
  const data = statusCounts.map(s => s.count);
  const labels = statusCounts.map(s => s.status.replace('_', ' '));
  const colors = statusCounts.map(s => statusMap[s.status] || '#9E9E9E');

  charts.status = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderColor: '#1A1A1A', borderWidth: 2 }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#9E9E9E', padding: 12 } }
      }
    }
  });
}

function renderTopItemsChart(topItems) {
  const ctx = document.getElementById('topItemsChart')?.getContext('2d');
  if (!ctx) return;

  const labels = topItems.slice(0, 10).map(i => i.name);
  const data = topItems.slice(0, 10).map(i => i.count);

  charts.topItems = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Times Ordered',
        data,
        backgroundColor: 'rgba(201,168,76,0.7)',
        borderColor: '#C9A84C',
        borderWidth: 1
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9E9E9E' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#9E9E9E' } }
      }
    }
  });
}

function renderPaymentChart(paymentMethods) {
  const ctx = document.getElementById('paymentChart')?.getContext('2d');
  if (!ctx) return;

  const colorMap = { jazzcash: '#00A651', easypaisa: '#ED7D31', meezan: '#00529B', hbl: '#DC143C', cod: '#2ECC71' };
  const labels = paymentMethods.map(p => p.payment_method);
  const data = paymentMethods.map(p => p.count);
  const colors = paymentMethods.map(p => colorMap[p.payment_method] || '#9E9E9E');

  charts.payment = new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderColor: '#1A1A1A', borderWidth: 2 }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#9E9E9E', padding: 12 } }
      }
    }
  });
}

function renderHourlyChart(hourlyOrders) {
  const ctx = document.getElementById('hourlyChart')?.getContext('2d');
  if (!ctx) return;

  const labels = hourlyOrders.map(h => `${h.hour}:00`);
  const data = hourlyOrders.map(h => h.count);

  charts.hourly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Orders',
        data,
        backgroundColor: 'rgba(107,26,42,0.7)',
        borderColor: '#6B1A2A',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9E9E9E' } },
        y: { ticks: { color: '#9E9E9E', beginAtZero: true }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
}

function renderCategoryChart(categoryRevenue) {
  const ctx = document.getElementById('categoryChart')?.getContext('2d');
  if (!ctx) return;

  const labels = categoryRevenue.slice(0, 10).map(c => c.name);
  const data = categoryRevenue.slice(0, 10).map(c => parseFloat(c.total) || 0);

  charts.category = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Revenue (Rs.)',
        data,
        backgroundColor: 'rgba(201,168,76,0.5)',
        borderColor: '#C9A84C',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9E9E9E' } },
        y: { ticks: { color: '#9E9E9E' }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', loadAnalytics);
