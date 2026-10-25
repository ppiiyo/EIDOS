import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 50 },     // Normal traffic
    { duration: '10s', target: 2000 },  // SPIKE! 50 → 2000 in 10 seconds
    { duration: '3m', target: 2000 },   // Sustain spike
    { duration: '10s', target: 50 },    // Drop back to normal
    { duration: '2m', target: 50 },     // Recovery validation
    { duration: '30s', target: 0 },     // Cool-down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'],
    'errors': ['rate<0.05'],
  },
};

const API_BASE = __ENV.API_BASE || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || 'eidos_public_demo_key_2026';

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
  };

  // All users hit the same 5 queries (tests SingleFlight under thundering herd)
  const hotQueries = ['iphone', 'airpods', 'macbook', 'ipad', 'apple watch'];
  const query = hotQueries[Math.floor(Math.random() * hotQueries.length)];

  const res = http.post(
    `${API_BASE}/v1/search`,
    JSON.stringify({ query, topK: 10 }),
    { headers }
  );

  const success = check(res, {
    'status is 200': (r) => r.status === 200,
  });

  errorRate.add(!success);
  sleep(0.2);
}

export function handleSummary(data) {
  return {
    'results/spike.json': JSON.stringify(data, null, 2),
  };
}
