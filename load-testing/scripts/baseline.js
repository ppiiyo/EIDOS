import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const cacheHitRate = new Rate('cache_hits');
const searchLatency = new Trend('search_latency');
const recommendLatency = new Trend('recommend_latency');
const totalRequests = new Counter('total_requests');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 20 },   // Warm-up: 0 → 20 users
    { duration: '1m', target: 50 },    // Ramp-up: 20 → 50 users
    { duration: '2m', target: 100 },   // Baseline: 50 → 100 users
    { duration: '1m', target: 100 },   // Sustain: hold 100 users
    { duration: '30s', target: 0 },    // Cool-down: 100 → 0 users
  ],
  thresholds: {
    'http_req_duration': ['p(95)<100', 'p(99)<200'], // 95% < 100ms, 99% < 200ms
    'errors': ['rate<0.01'],                          // Error rate < 1%
    'cache_hits': ['rate>0.5'],                       // Cache hit rate > 50%
  },
};

// Environment variables
const API_BASE = __ENV.API_BASE || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || 'eidos_demo_key';

// Realistic search queries (top 20 popular + 80 long-tail)
const POPULAR_QUERIES = [
  'wireless headphones',
  'running shoes',
  'laptop stand',
  'coffee maker',
  'yoga mat',
  'bluetooth speaker',
  'gaming mouse',
  'water bottle',
  'backpack',
  'desk lamp',
  'phone case',
  'sunglasses',
  'watch',
  'keyboard',
  'monitor',
  'webcam',
  'microphone',
  'charger',
  'cable',
  'adapter',
];

const LONG_TAIL_QUERIES = Array.from({ length: 80 }, (_, i) => `product query ${i + 1}`);

// 80% requests use popular queries (simulates real-world Zipf distribution)
function getRandomQuery() {
  if (Math.random() < 0.8) {
    return POPULAR_QUERIES[Math.floor(Math.random() * POPULAR_QUERIES.length)];
  } else {
    return LONG_TAIL_QUERIES[Math.floor(Math.random() * LONG_TAIL_QUERIES.length)];
  }
}

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
  };

  // 70% search requests, 30% recommend requests (realistic ratio)
  if (Math.random() < 0.7) {
    // Search request
    const query = getRandomQuery();
    const payload = JSON.stringify({
      query,
      topK: 10,
    });

    const start = Date.now();
    const res = http.post(`${API_BASE}/v1/search`, payload, { headers });
    const duration = Date.now() - start;

    totalRequests.add(1);
    searchLatency.add(duration);

    const success = check(res, {
      'status is 200': (r) => r.status === 200,
      'has results': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.results) && body.results.length > 0;
        } catch {
          return false;
        }
      },
      'response time < 200ms': (r) => r.timings.duration < 200,
    });

    errorRate.add(!success);

    // Track cache hits
    const cacheStatus = res.headers['X-Cache'] || res.headers['x-cache'];
    cacheHitRate.add(cacheStatus === 'HIT');

  } else {
    // Recommend request
    const userId = `user_${Math.floor(Math.random() * 50) + 1}`; // 50 active users
    const payload = JSON.stringify({
      userId,
      recentItemIds: [
        `item_${Math.floor(Math.random() * 100) + 1}`,
        `item_${Math.floor(Math.random() * 100) + 1}`,
      ],
      topK: 10,
    });

    const start = Date.now();
    const res = http.post(`${API_BASE}/v1/recommend`, payload, { headers });
    const duration = Date.now() - start;

    totalRequests.add(1);
    recommendLatency.add(duration);

    const success = check(res, {
      'status is 200': (r) => r.status === 200,
      'has recommendations': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.recommendations) && body.recommendations.length > 0;
        } catch {
          return false;
        }
      },
      'response time < 200ms': (r) => r.timings.duration < 200,
    });

    errorRate.add(!success);

    const cacheStatus = res.headers['X-Cache'] || res.headers['x-cache'];
    cacheHitRate.add(cacheStatus === 'HIT');
  }

  // Think time: 0.1–0.5 seconds between requests (simulates real user behavior)
  sleep(Math.random() * 0.4 + 0.1);
}

function formatTextSummary(data) {
  const reqs = data.metrics.http_reqs?.values?.count || 0;
  const qps = (data.metrics.http_reqs?.values?.rate || 0).toFixed(2);
  const p50 = (data.metrics.http_req_duration?.values?.['p(50)'] || 0).toFixed(2);
  const p95 = (data.metrics.http_req_duration?.values?.['p(95)'] || 0).toFixed(2);
  const p99 = (data.metrics.http_req_duration?.values?.['p(99)'] || 0).toFixed(2);
  const hits = ((data.metrics.cache_hits?.values?.rate || 0) * 100).toFixed(2);
  const errs = ((data.metrics.errors?.values?.rate || 0) * 100).toFixed(2);

  return [
    '==========================================',
    '  EIDOS BASELINE LOAD TEST SUMMARY',
    '==========================================',
    `  Total Requests:  ${reqs}`,
    `  Throughput:      ${qps} QPS`,
    `  Latency P50:     ${p50} ms`,
    `  Latency P95:     ${p95} ms`,
    `  Latency P99:     ${p99} ms`,
    `  Cache Hit Rate:  ${hits}%`,
    `  Error Rate:      ${errs}%`,
    '==========================================',
  ].join('\n');
}

export function handleSummary(data) {
  return {
    'results/baseline.json': JSON.stringify(data, null, 2),
    stdout: formatTextSummary(data) + '\n',
  };
}
