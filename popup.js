// popup.js - LanStation Traffic Monitor (simple HTTP polling)

let lanstationUrl = null;
let trafficLog = [];
let refreshInterval = null;
let chart = null;
let performanceMetrics = {
  fcp: null,
  lcp: null,
  cls: null,
  tbt: null,
  speedIndex: null,
  domReady: null
};

// Capture performance metrics using web-vitals
if (typeof window.webVitals !== 'undefined') {
  console.log('[Metrics] web-vitals library loaded');
  
  // First Contentful Paint
  window.webVitals.onCLS(metric => {
    performanceMetrics.cls = metric.value.toFixed(3);
    updateMetricsUI();
    console.log('[Metrics] CLS:', metric.value);
  });
  
  // Largest Contentful Paint
  window.webVitals.onLCP(metric => {
    performanceMetrics.lcp = metric.value.toFixed(0) + 'ms';
    updateMetricsUI();
    console.log('[Metrics] LCP:', metric.value);
  });
  
  // First Contentful Paint
  window.webVitals.onFCP(metric => {
    performanceMetrics.fcp = metric.value.toFixed(0) + 'ms';
    updateMetricsUI();
    console.log('[Metrics] FCP:', metric.value);
  });
  
  // Total Blocking Time
  window.webVitals.onTTFB(metric => {
    console.log('[Metrics] TTFB:', metric.value);
  });
  
  // Interaction to Next Paint (similar to TBT)
  window.webVitals.onINP(metric => {
    performanceMetrics.tbt = metric.value.toFixed(0) + 'ms';
    updateMetricsUI();
    console.log('[Metrics] INP (Total Blocking Time):', metric.value);
  });
}

// Measure DOM Ready Time
window.addEventListener('DOMContentLoaded', () => {
  if (performance.timing) {
    const domReady = performance.timing.domContentLoadedEventEnd - performance.timing.domContentLoadedEventStart;
    if (domReady > 0) {
      performanceMetrics.domReady = domReady.toFixed(0) + 'ms';
      console.log('[Metrics] DOM Ready:', domReady);
    }
  }
  updateMetricsUI();
  console.log('[Extension] DOM loaded, Chart.js available:', typeof Chart !== 'undefined');
});

// Calculate Speed Index approximation
window.addEventListener('load', () => {
  if (performance.timing) {
    const speedIndex = Math.max(0, performance.timing.loadEventEnd - performance.timing.navigationStart);
    if (speedIndex > 0) {
      performanceMetrics.speedIndex = speedIndex.toFixed(0) + 'ms';
      console.log('[Metrics] Speed Index:', speedIndex);
    }
  }
  updateMetricsUI();
});

function updateMetricsUI() {
  const metricsSection = document.getElementById('metricsSection');
  document.getElementById('fcp').textContent = performanceMetrics.fcp || '-';
  document.getElementById('lcp').textContent = performanceMetrics.lcp || '-';
  document.getElementById('cls').textContent = performanceMetrics.cls || '-';
  document.getElementById('tbt').textContent = performanceMetrics.tbt || '-';
  document.getElementById('speedIndex').textContent = performanceMetrics.speedIndex || '-';
  document.getElementById('domReady').textContent = performanceMetrics.domReady || '-';
  
  // Show metrics section once any metric is captured
  if (metricsSection && Object.values(performanceMetrics).some(v => v !== null)) {
    metricsSection.style.display = 'block';
  }
}

// DOM elements
const lanstationUrlInput = document.getElementById('lanstationUrl');
const apiKeyInput = document.getElementById('apiKey');
const connectBtn = document.getElementById('connect');
const testBtn = document.getElementById('test');
const refreshBtn = document.getElementById('refresh');
const connectionStatus = document.getElementById('connectionStatus');
const countEl = document.getElementById('count');
const listEl = document.getElementById('list');
const emptyState = document.getElementById('emptyState');
const analysisSection = document.getElementById('analysisSection');
const analysisEl = document.getElementById('analysis');
const chartSection = document.getElementById('chartSection');
const canvasEl = document.getElementById('responseChart');
const metricsSection = document.getElementById('metricsSection');
const slowlorisSection = document.getElementById('slowlorisSection');

// Load saved URL and API key on startup
chrome.storage.local.get(['lanstationUrl', 'apiKey'], (result) => {
  if (result.lanstationUrl) {
    lanstationUrlInput.value = result.lanstationUrl;
  }
  if (result.apiKey) {
    apiKeyInput.value = result.apiKey;
  }
});

// Connect button handler
connectBtn.addEventListener('click', () => {
  const url = lanstationUrlInput.value.trim();
  const apiKey = apiKeyInput.value.trim();
  
  if (!url) {
    alert('Please enter a LanStation URL');
    return;
  }

  if (!apiKey) {
    alert('Please enter the API Key');
    return;
  }

  if (connectBtn.textContent === 'Disconnect') {
    disconnect();
    return;
  }

  connect(url, apiKey);
});

// Test button handler
testBtn.addEventListener('click', () => {
  const url = lanstationUrlInput.value.trim().replace(/\/$/, '');
  const apiKey = apiKeyInput.value.trim();
  
  if (!url) {
    alert('Please enter a LanStation URL');
    return;
  }

  const headers = apiKey ? { 'X-Traffic-Key': apiKey } : {};
  
  testBtn.disabled = true;
  testBtn.textContent = 'Testing...';
  
  fetch(`${url}/api/health`, { method: 'GET', mode: 'cors', credentials: 'omit', headers })
    .then(resp => {
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    })
    .then(data => {
      alert('[OK] Server is reachable!\n' + JSON.stringify(data, null, 2));
      testBtn.disabled = false;
      testBtn.textContent = 'Test';
    })
    .catch(error => {
      alert('[ERROR] Cannot reach server:\n' + error.message);
      testBtn.disabled = false;
      testBtn.textContent = 'Test';
    });
});

function connect(url, apiKey) {
  connectBtn.disabled = true;
  connectBtn.textContent = 'Connecting...';
  
  // Ensure URL format (without trailing slash)
  url = url.replace(/\/$/, '');
  
  console.log('[Extension] Attempting connection:', url, 'with API key:', apiKey.substring(0, 5) + '***');
  
  // Test connection with API key
  fetch(`${url}/api/traffic`, { 
    method: 'GET', 
    mode: 'cors',
    credentials: 'omit',
    headers: { 'X-Traffic-Key': apiKey }
  })
    .then(resp => {
      console.log('[Extension] Response status:', resp.status);
      if (!resp.ok) throw new Error(`Server responded with ${resp.status}`);
      return resp.json();
    })
    .then(data => {
      lanstationUrl = url;
      chrome.storage.local.set({ lanstationUrl, apiKey });
      
      trafficLog = Array.isArray(data) ? data : [];
      connectionStatus.textContent = 'Connected';
      connectionStatus.classList.add('connected');
      connectBtn.disabled = false;
      connectBtn.textContent = 'Disconnect';
      
      renderTraffic();
      fetchSlowlorisMetrics(apiKey);
      
      // Poll for updates every 1 second
      if (refreshInterval) clearInterval(refreshInterval);
      refreshInterval = setInterval(() => fetchTraffic(apiKey), 1000);
    })
    .catch(error => {
      console.error('Connection failed:', error);
      alert('Failed to connect: ' + error.message + '\n\nMake sure:\n1. LanStation server is running\n2. Use your server IP (e.g., http://192.168.1.25)\n3. API Key is correct: trafficapikey\n\nCheck console for details.');
      connectBtn.disabled = false;
      connectBtn.textContent = 'Connect';
    });
}

function disconnect() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
  lanstationUrl = null;
  trafficLog = [];
  connectionStatus.textContent = 'Not Connected';
  connectionStatus.classList.remove('connected');
  connectBtn.disabled = false;
  connectBtn.textContent = 'Connect';
  renderTraffic();
}

function fetchTraffic(apiKey) {
  if (!lanstationUrl || !apiKey) return;
  
  fetch(`${lanstationUrl}/api/traffic`, { 
    method: 'GET', 
    mode: 'cors',
    credentials: 'omit',
    headers: { 'X-Traffic-Key': apiKey }
  })
    .then(resp => {
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    })
    .then(data => {
      trafficLog = Array.isArray(data) ? data : [];
      renderTraffic();
      if (connectionStatus.textContent !== 'Connected') {
        connectionStatus.textContent = 'Connected';
        connectionStatus.classList.add('connected');
      }
    })
    .catch(error => {
      console.error('Fetch failed:', error);
      if (connectionStatus.textContent !== 'Connection Lost') {
        connectionStatus.textContent = 'Connection Lost';
        connectionStatus.classList.remove('connected');
      }
    });
  
  // Also fetch Slowloris metrics
  fetchSlowlorisMetrics(apiKey);
}

function fetchSlowlorisMetrics(apiKey) {
  if (!lanstationUrl || !apiKey) return;
  
  fetch(`${lanstationUrl}/api/slowloris`, { 
    method: 'GET', 
    mode: 'cors',
    credentials: 'omit',
    headers: { 'X-Traffic-Key': apiKey }
  })
    .then(resp => {
      console.log('[Slowloris] API response status:', resp.status);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    })
    .then(data => {
      console.log('[Slowloris] Got metrics:', data);
      updateSlowlorisUI(data);
    })
    .catch(error => {
      console.error('[Slowloris] Fetch failed:', error);
    });
}

function updateSlowlorisUI(metrics) {
  console.log('[Slowloris] Updating UI with metrics:', metrics);
  if (!metrics || !slowlorisSection) {
    console.log('[Slowloris] Metrics or section missing:', !!metrics, !!slowlorisSection);
    return;
  }
  
  slowlorisSection.style.display = 'block';
  
  // Update risk level with color coding
  const riskEl = document.getElementById('riskLevel');
  if (riskEl) {
    riskEl.textContent = metrics.riskLevel || 'UNKNOWN';
    riskEl.style.color = 
      metrics.riskLevel === 'HIGH' ? '#ef4444' :
      metrics.riskLevel === 'MEDIUM' ? '#f59e0b' :
      '#10b981';
  }
  
  // Update open/hanging connections - show total open connections as primary metric
  const hangingEl = document.getElementById('hangingRequests');
  if (hangingEl) {
    const totalOpen = metrics.openConnections || 0;
    const hungCount = metrics.hangingConnections || 0;
    hangingEl.textContent = `${totalOpen} open (${hungCount} hung)`;
    hangingEl.style.color = (totalOpen > 50 || hungCount > 10) ? '#ef4444' : '#60a5fa';
  }
  
  // Update threat status
  const threatEl = document.getElementById('threatStatus');
  if (threatEl) {
    threatEl.textContent = metrics.threat || 'Normal operations';
    threatEl.style.color = metrics.riskLevel === 'HIGH' ? '#ef4444' : metrics.riskLevel === 'MEDIUM' ? '#f59e0b' : '#10b981';
  }
  
  // Update suspicious IPs from hung connections
  const ipsEl = document.getElementById('suspiciousIPs');
  if (ipsEl) {
    if (metrics.suspiciousIPs && metrics.suspiciousIPs.length > 0) {
      ipsEl.innerHTML = metrics.suspiciousIPs.map(ip => 
        `<div>${ip.ip} - ${ip.hung} hung connection(s)</div>`
      ).join('');
    } else if (metrics.incompleteConnections && metrics.incompleteConnections.length > 0) {
      // Show incomplete connections if no hung ones
      ipsEl.innerHTML = metrics.incompleteConnections.filter(x => x.count > 5).map(ip => 
        `<div>${ip.ip} - ${ip.count} incomplete connection(s)</div>`
      ).join('') || 'None detected';
    } else {
      ipsEl.innerHTML = 'None detected';
    }
  }
}

// Refresh button handler
refreshBtn.addEventListener('click', () => {
  if (lanstationUrl && apiKeyInput.value) {
    fetchTraffic(apiKeyInput.value);
  }
});

// Filter out extension's own API traffic requests
function getFilteredTraffic() {
  return trafficLog.filter(entry => entry.path !== '/api/traffic' && entry.path !== '/api/slowloris');
}

function renderTraffic() {
  const filteredTraffic = getFilteredTraffic();
  
  if (!filteredTraffic || filteredTraffic.length === 0) {
    listEl.innerHTML = '';
    emptyState.style.display = 'block';
    analysisSection.style.display = 'none';
    chartSection.style.display = 'none';
    countEl.textContent = '';
    return;
  }

  emptyState.style.display = 'none';
  analysisSection.style.display = 'block';
  chartSection.style.display = 'block';

  countEl.textContent = `${filteredTraffic.length} requests`;
  listEl.innerHTML = '';
  
  // Show only last 30 entries
  filteredTraffic.slice(0, 30).forEach((entry) => {
    const div = document.createElement('div');
    div.className = 'entry';

    // Determine status color
    const statusCode = entry.statusCode || 0;
    if (statusCode >= 500) div.classList.add('error');
    else if (statusCode >= 400) div.classList.add('error');
    else if (statusCode >= 200 && statusCode < 300) div.classList.add('success');

    // Determine if slow (>500ms)
    if ((entry.duration || 0) > 500) div.classList.add('slow');

    const urlEl = document.createElement('div');
    urlEl.className = 'url';
    urlEl.textContent = entry.path || entry.url || '/unknown';

    const metaEl = document.createElement('div');
    metaEl.className = 'meta';

    const method = (entry.method || 'GET').toLowerCase();
    const methodBadge = `<span class="badge method-${method}">${entry.method || 'GET'}</span>`;
    const statusBadge = `<span class="badge status-${Math.floor((entry.statusCode || 0) / 100)}xx">${entry.statusCode || '?'}</span>`;
    const timeEl = `<span class="badge">${entry.duration || 0}ms</span>`;
    const timeStr = new Date(entry.timestamp).toLocaleTimeString();
    const timeBadge = `<span class="badge">${timeStr}</span>`;

    metaEl.innerHTML = `${methodBadge}${statusBadge}${timeEl}${timeBadge}`;

    div.appendChild(urlEl);
    div.appendChild(metaEl);
    listEl.appendChild(div);
  });

  // Generate analysis and chart
  generateAnalysis();
  renderChart();
}

function generateAnalysis() {
  const filteredTraffic = getFilteredTraffic();
  chrome.runtime.sendMessage(
    { type: 'ANALYZE_TRAFFIC', traffic: filteredTraffic },
    (response) => {
      if (response && response.analysis) {
        const analysis = response.analysis;
        
        let html = `
          <div class="analysis">
            <div class="analysis-row">
              <span>Total Requests:</span>
              <strong>${analysis.totalRequests}</strong>
            </div>
            <div class="analysis-row">
              <span>Avg Response Time:</span>
              <strong>${analysis.averageResponseTime}ms</strong>
            </div>
        `;

        if (analysis.topPaths) {
          html += '<div class="analysis-row" style="flex-direction: column; align-items: flex-start;">';
          html += '<span>Top Endpoints:</span>';
          Object.entries(analysis.topPaths).slice(0, 3).forEach(([path, count]) => {
            html += `<span style="font-size: 10px; color: #9aa3b2;">${path} (${count})</span>`;
          });
          html += '</div>';
        }

        html += `
            <div class="analysis-row">
              <span>Methods:</span>
              <strong>${Object.entries(analysis.methods).map(([m, c]) => `${m}:${c}`).join(', ')}</strong>
            </div>
            <div class="analysis-row">
              <span>Status Codes:</span>
              <strong>${Object.entries(analysis.statusCodes).map(([c, cnt]) => `${c}:${cnt}`).join(', ')}</strong>
            </div>
        `;

        if (analysis.slowestRequests && analysis.slowestRequests.length > 0) {
          html += '<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #374151;">';
          html += '<span style="font-size: 10px; color: #f59e0b;">Slowest Requests:</span>';
          analysis.slowestRequests.slice(0, 3).forEach((req) => {
            html += `<div style="font-size: 9px; color: #9aa3b2; margin-top: 4px;">${req.path} - ${req.duration}ms (${req.statusCode})</div>`;
          });
          html += '</div>';
        }

        html += '</div>';
        analysisEl.innerHTML = html;
      }
    }
  );
}

function renderChart() {
  console.log('[Chart] renderChart called, Chart available:', typeof window.Chart !== 'undefined');
  
  // Wait for Chart.js to be available
  if (typeof window.Chart === 'undefined') {
    console.warn('[Chart] Chart.js not yet loaded, retrying...');
    setTimeout(renderChart, 100);
    return;
  }

  const filteredTraffic = getFilteredTraffic();
  
  if (!filteredTraffic || filteredTraffic.length === 0) {
    console.log('[Chart] No traffic log, hiding chart');
    chartSection.style.display = 'none';
    return;
  }

  console.log('[Chart] Rendering chart with', filteredTraffic.length, 'entries');
  chartSection.style.display = 'block';

  // Prepare chart data - last 30 requests
  const data = filteredTraffic.slice(0, 30).reverse();
  console.log('[Chart] Using', data.length, 'data points');
  
  const labels = data.map((entry) => {
    const time = new Date(entry.timestamp);
    return time.toLocaleTimeString();
  });
  
  const durations = data.map(entry => entry.duration || 0);
  const colors = data.map(entry => {
    const duration = entry.duration || 0;
    if (duration > 500) return 'rgba(245, 158, 11, 0.8)';
    if (duration > 200) return 'rgba(96, 165, 250, 0.8)';
    return 'rgba(16, 185, 129, 0.8)';
  });

  if (!canvasEl) {
    console.error('[Chart] Canvas element not found!');
    return;
  }

  console.log('[Chart] Canvas element:', canvasEl);

  const chartData = {
    labels: labels,
    datasets: [{
      label: 'Response Time (ms)',
      data: durations,
      borderColor: 'rgba(96, 165, 250, 1)',
      backgroundColor: 'rgba(96, 165, 250, 0.1)',
      borderWidth: 2,
      tension: 0.4,
      fill: true,
      pointBackgroundColor: colors,
      pointBorderColor: 'rgba(107, 114, 128, 0.5)',
      pointRadius: 4,
      pointHoverRadius: 6
    }]
  };

  try {
    // Ensure canvas has proper dimensions
    console.log('[Chart] Canvas current dimensions:', canvasEl.width, 'x', canvasEl.height);
    
    const ctx = canvasEl.getContext('2d');
    console.log('[Chart] Canvas context created:', !!ctx);
    
    if (!ctx) {
      console.error('[Chart] Failed to get 2D context');
      return;
    }

    if (chart) {
      console.log('[Chart] Destroying existing chart');
      chart.destroy();
      chart = null;
    }

    console.log('[Chart] Creating new chart instance');
    console.log('[Chart] Data points:', durations.length);
    console.log('[Chart] Sample duration values:', durations.slice(0, 5));
    
    chart = new window.Chart(ctx, {
      type: 'line',
      data: chartData,
      options: {
        animation: false,  // Disable animations
        responsive: false,  // Disable responsive to use explicit canvas dimensions
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: {
              color: '#9aa3b2',
              font: { size: 10 },
              padding: 15
            }
          },
          tooltip: {
            backgroundColor: '#1f2937',
            titleColor: '#e5e7eb',
            bodyColor: '#9aa3b2',
            borderColor: '#374151',
            borderWidth: 1,
            padding: 8
          }
        },
        scales: {
          x: {
            ticks: {
              color: '#9aa3b2',
              font: { size: 9 },
              maxRotation: 45,
              minRotation: 0
            },
            grid: {
              color: 'rgba(107, 114, 128, 0.1)'
            }
          },
          y: {
            beginAtZero: true,
            max: Math.max(...durations) > 0 ? Math.max(...durations) * 1.1 : 100,
            ticks: {
              color: '#9aa3b2',
              font: { size: 9 },
              callback: function(value) {
                return Math.round(value) + 'ms';
              }
            },
            grid: {
              color: 'rgba(107, 114, 128, 0.1)'
            }
          }
        }
      }
    });
    console.log('[Chart] Chart created and rendered successfully');
  } catch (error) {
    console.error('[Chart] Error creating chart:', error);
    console.error('[Chart] Stack:', error.stack);
  }
}

// Cleanup on window close
window.addEventListener('beforeunload', () => {
  if (refreshInterval) clearInterval(refreshInterval);
});
