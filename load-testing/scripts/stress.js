import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');
const cacheHitRate = new Rate('cache_hits');

export const options = {
  stages: [
    { duration: '1m', target: 100 },    // Warm-up
    { duration: '2m', target: 300 },    // Normal load
    { duration: '2m', target: 500 },    // High load
    { duration: '2m', target: 1000 },   // Very high load
    { duration: '2m', target: 1500 },   // Extreme load
    { duration: '2m', target: 2000 },   // Breaking point search
    { duration: '2m', target: 3000 },   // Maximum stress
    { duration: '2m', target: 0 },      // Recovery
  ],
  thresholds: {
    'http_req_duration': ['p(99)<1000'], // Relaxed threshold for stress test
    'errors': ['rate<0.05'],              // Allow up to 5% errors at extreme load
  },
};

const API_BASE = __ENV.API_BASE || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || 'eidos_demo_key';

const QUERIES = [
  'wireless headphones', 'running shoes', 'laptop stand', 'coffee maker',
  'yoga mat', 'bluetooth speaker', 'gaming mouse', 'water bottle',
  'backpack', 'desk lamp', 'phone case', 'sunglasses', 'watch',
  'keyboard', 'monitor', 'webcam', 'microphone', 'charger',
];

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
  };

  const query = QUERIES[Math.floor(Math.random() * QUERIES.length)];
  const payload = JSON.stringify({ query, topK: 10 });

  const res = http.post(`${API_BASE}/v1/search`, payload, { headers });

  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'status is not 5xx': (r) => r.status < 500,
  });

  errorRate.add(!success);

  const cacheStatus = res.headers['X-Cache'] || res.headers['x-cache'];
  cacheHitRate.add(cacheStatus === 'HIT');

  sleep(0.1); // Aggressive: 10 req/s per VU
}

export function handleSummary(data) {
  return {
    'results/stress.json': JSON.stringify(data, null, 2),
  };
}
