// background.js - LanStation Traffic Monitor Analysis

console.log("[LanStation Monitor] Service worker started");

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ANALYZE_TRAFFIC") {
    analyzeTraffic(message.traffic, sendResponse);
    return true;
  }
});

// Simple traffic analysis function
function analyzeTraffic(trafficLog, sendResponse) {
  if (!trafficLog || trafficLog.length === 0) {
    sendResponse({ analysis: null });
    return;
  }

  const analysis = {
    totalRequests: trafficLog.length,
    statusCodes: {},
    methods: {},
    slowestRequests: [],
    mostFrequentPaths: {},
    averageResponseTime: 0,
  };

  let totalDuration = 0;

  trafficLog.forEach((entry) => {
    // Count status codes
    const code = entry.statusCode || "unknown";
    analysis.statusCodes[code] = (analysis.statusCodes[code] || 0) + 1;

    // Count methods
    const method = entry.method || "GET";
    analysis.methods[method] = (analysis.methods[method] || 0) + 1;

    // Track slowest requests
    totalDuration += entry.duration || 0;
    analysis.slowestRequests.push({
      path: entry.path,
      method: entry.method,
      duration: entry.duration,
      statusCode: entry.statusCode,
    });

    // Count paths
    const path = entry.path || "/";
    analysis.mostFrequentPaths[path] =
      (analysis.mostFrequentPaths[path] || 0) + 1;
  });

  // Sort slowest requests
  analysis.slowestRequests.sort((a, b) => (b.duration || 0) - (a.duration || 0));
  analysis.slowestRequests = analysis.slowestRequests.slice(0, 10);

  // Calculate averages
  analysis.averageResponseTime =
    Math.round(totalDuration / trafficLog.length * 10) / 10;

  // Get top 5 paths
  const sortedPaths = Object.entries(analysis.mostFrequentPaths)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  analysis.topPaths = Object.fromEntries(sortedPaths);

  sendResponse({ analysis });
}


