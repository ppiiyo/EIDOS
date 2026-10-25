#!/bin/bash

echo "=========================================="
echo "📊 EIDOS LOAD TEST RESULTS ANALYSIS"
echo "=========================================="
echo ""

RESULTS_DIR="load-testing/results"
if [ ! -d "$RESULTS_DIR" ] && [ -d "results" ]; then
  RESULTS_DIR="results"
fi

print_report() {
  local title="$1"
  local file="$2"

  if [ ! -f "$file" ]; then
    return
  fi

  echo "=== $title ==="
  if command -v jq >/dev/null 2>&1; then
    jq -r '
      "Total Requests:   \(.metrics.http_reqs.values.count)",
      "Throughput (QPS): \(.metrics.http_reqs.values.rate | floor)",
      "Latency P50:      \(.metrics.http_req_duration.values["p(50)"])ms",
      "Latency P95:      \(.metrics.http_req_duration.values["p(95)"])ms",
      "Latency P99:      \(.metrics.http_req_duration.values["p(99)"])ms",
      "Latency Max:      \(.metrics.http_req_duration.values.max)ms",
      "Error Rate:       \((.metrics.errors.values.rate * 10000 | round) / 100)%",
      "Cache Hit Rate:   \((.metrics.cache_hits.values.rate * 10000 | round) / 100)%"
    ' "$file"
  else
    node -e '
      const fs = require("fs");
      const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      const m = data.metrics;
      console.log(`Total Requests:   ${m.http_reqs.values.count}`);
      console.log(`Throughput (QPS): ${Math.floor(m.http_reqs.values.rate)}`);
      console.log(`Latency P50:      ${m.http_req_duration.values["p(50)"]}ms`);
      console.log(`Latency P95:      ${m.http_req_duration.values["p(95)"]}ms`);
      console.log(`Latency P99:      ${m.http_req_duration.values["p(99)"]}ms`);
      console.log(`Latency Max:      ${m.http_req_duration.values.max}ms`);
      console.log(`Error Rate:       ${(m.errors.values.rate * 100).toFixed(2)}%`);
      console.log(`Cache Hit Rate:   ${(m.cache_hits.values.rate * 100).toFixed(2)}%`);
    ' "$file"
  fi
  echo ""
}

if [ -n "$1" ] && [ -f "$1" ]; then
  print_report "CUSTOM REPORT ($1)" "$1"
  exit 0
fi

print_report "1. BASELINE TEST (70% Search / 30% Recommend)" "$RESULTS_DIR/baseline.json"
print_report "2. STRESS TEST (High Concurrency Ramp)" "$RESULTS_DIR/stress.json"
print_report "3. SPIKE TEST (SingleFlight Hot-Key Surge)" "$RESULTS_DIR/spike.json"
print_report "4. SOAK TEST (80% Popular / 20% Unique Eviction)" "$RESULTS_DIR/soak.json"

echo "=========================================="
echo "🎯 RECOMMENDATIONS"
echo "=========================================="

if [ -f "$RESULTS_DIR/baseline.json" ]; then
  node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync("'"$RESULTS_DIR"'/baseline.json", "utf8"));
    const p95 = data.metrics.http_req_duration.values["p(95)"] || 0;
    const errRate = data.metrics.errors.values.rate || 0;
    const hitRate = data.metrics.cache_hits.values.rate || 0;

    if (p95 > 100) {
      console.log("⚠️  P95 latency > 100ms: optimize HNSW efSearch / M parameters");
    } else {
      console.log("✅ P95 latency within threshold (<100ms): " + p95 + "ms");
    }

    if (errRate > 0.01) {
      console.log("⚠️  Error rate > 1%: circuit breaker and backoff required");
    } else {
      console.log("✅ Error rate within threshold (<1%): " + (errRate * 100).toFixed(2) + "%");
    }

    if (hitRate < 0.70) {
      console.log("⚠️  Cache hit rate < 70%: review TTL and query normalization");
    } else {
      console.log("✅ Cache hit rate optimal (>70%): " + (hitRate * 100).toFixed(2) + "%");
    }
  '
fi

echo ""
echo "✅ Analysis complete"
