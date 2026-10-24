import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 100,
  duration: '5m',
  thresholds: {
    http_req_duration: ['p(95)<50'], // P95 < 50ms
    http_req_failed: ['rate<0.01'], // Error rate < 1%
  },
};

export default function () {
  const queries = ['наушники', 'ноутбук', 'смартфон', 'кофемашина', 'кроссовки'];
  const query = queries[Math.floor(Math.random() * queries.length)];

  const response = http.post(
    'http://localhost:8080/v1/search',
    JSON.stringify({ query, limit: 10 }),
    { headers: { 'Content-Type': 'application/json', 'x-api-key': 'test-key' } }
  );

  check(response, {
    'status is 200': (r) => r.status === 200,
    'latency < 50ms': (r) => r.timings.duration < 50,
  });

  sleep(0.1);
}
