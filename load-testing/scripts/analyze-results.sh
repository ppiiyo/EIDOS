#!/bin/bash

echo "=========================================="
echo "📊 EIDOS LOAD TEST RESULTS ANALYSIS"
echo "=========================================="
echo ""

RESULTS_FILE="${1:-results/baseline.json}"
if [ ! -f "$RESULTS_FILE" ] && [ -f "load-testing/results/baseline.json" ]; then
  RESULTS_FILE="load-testing/results/baseline.json"
fi

if [ -f "$RESULTS_FILE" ]; then
  echo "=== BASELINE TEST (100 VU) ==="
  if command -v jq >/dev/null 2>&1; then
    jq -r '
      "Total Requests:   \(.metrics.http_reqs.values.count)",
      "Throughput (QPS): \(.metrics.http_reqs.values.rate | floor)",
      "Latency P50:      \(.metrics.http_req_duration.values["p(50)"] | floor)ms",
      "Latency P95:      \(.metrics.http_req_duration.values["p(95)"] | floor)ms",
      "Latency P99:      \(.metrics.http_req_duration.values["p(99)"] | floor)ms",
      "Latency Max:      \(.metrics.http_req_duration.values.max | floor)ms",
      "Error Rate:       \((.metrics.errors.values.rate * 100) | floor)%",
      "Cache Hit Rate:   \((.metrics.cache_hits.values.rate * 100) | floor)%"
    ' "$RESULTS_FILE"
  else
    node -e '
      const fs = require("fs");
      const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      const m = data.metrics;
      console.log(`Total Requests:   ${m.http_reqs.values.count}`);
      console.log(`Throughput (QPS): ${Math.floor(m.http_reqs.values.rate)}`);
      console.log(`Latency P50:      ${Math.floor(m.http_req_duration.values["p(50)"])}ms`);
      console.log(`Latency P95:      ${Math.floor(m.http_req_duration.values["p(95)"])}ms`);
      console.log(`Latency P99:      ${Math.floor(m.http_req_duration.values["p(99)"])}ms`);
      console.log(`Latency Max:      ${Math.floor(m.http_req_duration.values.max)}ms`);
      console.log(`Error Rate:       ${Math.floor(m.errors.values.rate * 100)}%`);
      console.log(`Cache Hit Rate:   ${Math.floor(m.cache_hits.values.rate * 100)}%`);
    ' "$RESULTS_FILE"
  fi
  echo ""
else
  echo "Results file not found: $RESULTS_FILE"
  exit 1
fi
