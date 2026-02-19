const express = require('express');
const path = require('path');
const app = express();

// Traffic logging
const trafficLog = [];
const MAX_LOG_SIZE = 500;

// Middleware to log all requests
app.use((req, res, next) => {
  const startTime = Date.now();
  
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    const trafficEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: duration,
      userAgent: req.get('user-agent') || 'unknown',
      ip: req.ip
    };
    
    // Log traffic (exclude traffic API itself)
    if (req.path !== '/api/traffic' && req.path !== '/api/metrics') {
      trafficLog.unshift(trafficEntry);
      if (trafficLog.length > MAX_LOG_SIZE) trafficLog.pop();
      console.log(`[Traffic] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    }
    
    originalEnd.apply(res, args);
  };
  
  next();
});

// Enable CORS for extension
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Traffic-Key');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API: Get traffic log
app.get('/api/traffic', (req, res) => {
  const apiKey = (req.get('X-Traffic-Key') || '').trim();
  const expectedKey = (process.env.TRAFFIC_API_KEY || 'trafficapikey').trim();
  
  if (apiKey !== expectedKey) {
    console.log('[API] Unauthorized traffic request from', req.ip);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  console.log('[API] /api/traffic - returning', trafficLog.length, 'entries');
  res.json(trafficLog);
});

// API: Get metrics
app.get('/api/metrics', (req, res) => {
  const apiKey = (req.get('X-Traffic-Key') || '').trim();
  const expectedKey = (process.env.TRAFFIC_API_KEY || 'trafficapikey').trim();
  
  if (apiKey !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let avgResponseTime = 0;
  let minResponseTime = Infinity;
  let maxResponseTime = 0;
  let totalRequests = trafficLog.length;
  let successRequests = 0;
  let errorRequests = 0;
  let statusCodes = {};
  
  if (trafficLog.length > 0) {
    let totalDuration = 0;
    
    trafficLog.forEach(entry => {
      const duration = entry.duration || 0;
      totalDuration += duration;
      minResponseTime = Math.min(minResponseTime, duration);
      maxResponseTime = Math.max(maxResponseTime, duration);
      
      const status = entry.statusCode || 'unknown';
      statusCodes[status] = (statusCodes[status] || 0) + 1;
      
      if (status >= 200 && status < 300) {
        successRequests++;
      } else if (status >= 400) {
        errorRequests++;
      }
    });
    
    avgResponseTime = Math.round((totalDuration / trafficLog.length) * 100) / 100;
    minResponseTime = minResponseTime === Infinity ? 0 : minResponseTime;
  }
  
  const metrics = {
    fcp: avgResponseTime + 'ms',
    lcp: maxResponseTime + 'ms',
    cls: (totalRequests > 0 ? Math.round((successRequests / totalRequests) * 100) : 0) + '%',
    tbt: (totalRequests > 0 ? Math.round((errorRequests / totalRequests) * 100) : 0) + '%',
    speedIndex: totalRequests + ' requests',
    domReady: (Math.round((totalRequests / 60) * 100) / 100) + ' req/min'
  };
  
  console.log('[API] /api/metrics called');
  res.json(metrics);
});

// API: Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Test endpoints that return different responses
app.get('/test/ok', (req, res) => {
  res.status(200).json({ message: 'Success' });
});

app.get('/test/error', (req, res) => {
  res.status(500).json({ error: 'Server error' });
});

app.get('/test/notfound', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.get('/test/slow', (req, res) => {
  setTimeout(() => {
    res.json({ message: 'Slow response', delay: 2000 });
  }, 2000);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.PORT || 80;
app.listen(PORT, () => {
  console.log(`\n[Server] Test server running on http://localhost:${PORT}`);
  console.log(`[Server] API: /api/traffic (requires X-Traffic-Key header)`);
  console.log(`[Server] API: /api/metrics (requires X-Traffic-Key header)`);
  console.log(`[Server] Test page: http://localhost:${PORT}/\n`);
});
