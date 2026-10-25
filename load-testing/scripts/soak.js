import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 100 },    // Ramp-up
    { duration: '56m', target: 100 },   // Sustain for ~1 hour (detect memory leaks)
    { duration: '2m', target: 0 },      // Cool-down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<100', 'p(99)<200'],
    'errors': ['rate<0.001'], // < 0.1% errors over 1 hour
  },
};

const API_BASE = __ENV.API_BASE || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || 'eidos_public_demo_key_2026';

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
  };

  // Mix of cached and unique queries (tests memory eviction in fallback cache)
  const isUnique = Math.random() < 0.2;
  const query = isUnique
    ? `unique_query_${Date.now()}_${Math.random()}`
    : `popular_query_${Math.floor(Math.random() * 50)}`;

  const res = http.post(
    `${API_BASE}/v1/search`,
    JSON.stringify({ query, topK: 10 }),
    { headers }
  );

  const success = check(res, {
    'status is 200': (r) => r.status === 200,
  });

  errorRate.add(!success);
  sleep(0.5);
}

export function handleSummary(data) {
  return {
    'results/soak.json': JSON.stringify(data, null, 2),
  };
}
