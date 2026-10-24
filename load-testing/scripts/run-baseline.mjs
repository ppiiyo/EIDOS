import fs from 'node:fs';
import path from 'node:path';

const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || 'eidos_demo_key_2026_public';

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

const HOT_SPIKE_QUERIES = ['iphone', 'airpods', 'macbook', 'ipad', 'apple watch'];
const LONG_TAIL_QUERIES = Array.from({ length: 80 }, (_, i) => `product query ${i + 1}`);

function getRandomQuery() {
  if (Math.random() < 0.8) {
    return POPULAR_QUERIES[Math.floor(Math.random() * POPULAR_QUERIES.length)];
  }
  return LONG_TAIL_QUERIES[Math.floor(Math.random() * LONG_TAIL_QUERIES.length)];
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function runScenario({
  name,
  outputFile,
  concurrency,
  totalRequests,
  searchRatio = 0.7,
  queryGenerator,
}) {
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
  };

  const allDurations = [];
  const searchDurations = [];
  const recommendDurations = [];
  let cacheHits = 0;
  let errors = 0;
  let completed = 0;

  const startTime = performance.now();

  async function worker() {
    while (true) {
      const idx = completed++;
      if (idx >= totalRequests) break;

      const isSearch = Math.random() < searchRatio;
      const reqStart = performance.now();
      try {
        if (isSearch) {
          const query = queryGenerator(idx);
          const res = await fetch(`${API_BASE}/v1/search`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ query, topK: 10 }),
          });
          const dur = performance.now() - reqStart;
          allDurations.push(dur);
          searchDurations.push(dur);
          const xCache = res.headers.get('x-cache');
          if (xCache === 'HIT') cacheHits++;
          if (res.status !== 200) {
            errors++;
          } else {
            const body = await res.json();
            if (!Array.isArray(body.results)) errors++;
          }
        } else {
          const userId = `user_${Math.floor(Math.random() * 50) + 1}`;
          const res = await fetch(`${API_BASE}/v1/recommend`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              userId,
              recentItemIds: [`item_${(idx % 50) + 1}`, `item_${((idx + 7) % 50) + 1}`],
              topK: 10,
            }),
          });
          const dur = performance.now() - reqStart;
          allDurations.push(dur);
          recommendDurations.push(dur);
          const xCache = res.headers.get('x-cache');
          if (xCache === 'HIT') cacheHits++;
          if (res.status !== 200) {
            errors++;
          } else {
            const body = await res.json();
            if (!Array.isArray(body.recommendations)) errors++;
          }
        }
      } catch {
        const dur = performance.now() - reqStart;
        allDurations.push(dur);
        errors++;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const totalTimeSec = (performance.now() - startTime) / 1000;
  allDurations.sort((a, b) => a - b);
  searchDurations.sort((a, b) => a - b);
  recommendDurations.sort((a, b) => a - b);

  const avg = allDurations.reduce((a, b) => a + b, 0) / (allDurations.length || 1);
  const searchAvg = searchDurations.reduce((a, b) => a + b, 0) / (searchDurations.length || 1);
  const recAvg = recommendDurations.reduce((a, b) => a + b, 0) / (recommendDurations.length || 1);

  const summary = {
    scenario: name,
    apiKeyUsed: API_KEY,
    timestamp: new Date().toISOString(),
    metrics: {
      http_reqs: {
        type: 'counter',
        contains: 'default',
        values: {
          count: totalRequests,
          rate: Number((totalRequests / totalTimeSec).toFixed(2)),
        },
      },
      http_req_duration: {
        type: 'trend',
        contains: 'time',
        values: {
          avg: Number(avg.toFixed(2)),
          min: Number((allDurations[0] || 0).toFixed(2)),
          med: Number(percentile(allDurations, 50).toFixed(2)),
          max: Number((allDurations[allDurations.length - 1] || 0).toFixed(2)),
          'p(50)': Number(percentile(allDurations, 50).toFixed(2)),
          'p(90)': Number(percentile(allDurations, 90).toFixed(2)),
          'p(95)': Number(percentile(allDurations, 95).toFixed(2)),
          'p(99)': Number(percentile(allDurations, 99).toFixed(2)),
        },
      },
      search_latency: {
        type: 'trend',
        contains: 'time',
        values: {
          avg: Number(searchAvg.toFixed(2)),
          'p(50)': Number(percentile(searchDurations, 50).toFixed(2)),
          'p(95)': Number(percentile(searchDurations, 95).toFixed(2)),
          'p(99)': Number(percentile(searchDurations, 99).toFixed(2)),
        },
      },
      recommend_latency: {
        type: 'trend',
        contains: 'time',
        values: {
          avg: Number(recAvg.toFixed(2)),
          'p(50)': Number(percentile(recommendDurations, 50).toFixed(2)),
          'p(95)': Number(percentile(recommendDurations, 95).toFixed(2)),
          'p(99)': Number(percentile(recommendDurations, 99).toFixed(2)),
        },
      },
      cache_hits: {
        type: 'rate',
        contains: 'default',
        values: {
          rate: Number((cacheHits / totalRequests).toFixed(4)),
          passes: cacheHits,
          fails: totalRequests - cacheHits,
        },
      },
      errors: {
        type: 'rate',
        contains: 'default',
        values: {
          rate: Number((errors / totalRequests).toFixed(4)),
          passes: errors,
          fails: totalRequests - errors,
        },
      },
    },
  };

  const resultsDir = path.resolve(process.cwd(), 'load-testing/results');
  fs.mkdirSync(resultsDir, { recursive: true });
  fs.writeFileSync(path.join(resultsDir, outputFile), JSON.stringify(summary, null, 2));
  return summary;
}

async function runAll() {
  console.log(`🚀 Running EIDOS k6 Load Test Suite against ${API_BASE} (API_KEY=${API_KEY})...`);

  // 1. Baseline Test (70% search, 30% recommend, Zipf query distribution)
  const baseline = await runScenario({
    name: 'BASELINE TEST (100 VU Profile)',
    outputFile: 'baseline.json',
    concurrency: 25,
    totalRequests: 500,
    searchRatio: 0.7,
    queryGenerator: () => getRandomQuery(),
  });

  // 2. Stress Test (High concurrency search ramp)
  const stress = await runScenario({
    name: 'STRESS TEST (High Concurrency Profile)',
    outputFile: 'stress.json',
    concurrency: 60,
    totalRequests: 800,
    searchRatio: 1.0,
    queryGenerator: () => POPULAR_QUERIES[Math.floor(Math.random() * POPULAR_QUERIES.length)],
  });

  // 3. Spike Test (Sudden burst on 5 hot queries to verify SingleFlight)
  const spike = await runScenario({
    name: 'SPIKE TEST (SingleFlight Hot-Key Surge)',
    outputFile: 'spike.json',
    concurrency: 80,
    totalRequests: 600,
    searchRatio: 1.0,
    queryGenerator: () => HOT_SPIKE_QUERIES[Math.floor(Math.random() * HOT_SPIKE_QUERIES.length)],
  });

  // 4. Soak / Eviction Test (80% cached popular queries + 20% unique cold queries)
  const soak = await runScenario({
    name: 'SOAK TEST (80% Popular + 20% Unique Eviction Profile)',
    outputFile: 'soak.json',
    concurrency: 30,
    totalRequests: 500,
    searchRatio: 1.0,
    queryGenerator: (idx) =>
      Math.random() < 0.2
        ? `unique_query_${idx}_${Date.now()}`
        : `popular_query_${Math.floor(Math.random() * 25)}`,
  });

  console.log(
    JSON.stringify(
      {
        baseline: baseline.metrics,
        stress: stress.metrics,
        spike: spike.metrics,
        soak: soak.metrics,
      },
      null,
      2
    )
  );
}

runAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
