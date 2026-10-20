import React from 'react';
import { CheckCircle2, Activity, Play } from 'lucide-react';

interface BenchmarkMetrics {
  hnswLatencyMs: number;
  linearLatencyMs: number;
  speedup: string;
  totalItems: number;
  recallTopK: number;
  qpsHnsw: number;
}

interface HnswBenchmarkCardProps {
  catalogLength: number;
  isScaledCatalog: boolean;
  isBenchmarking: boolean;
  benchmarkMetrics: BenchmarkMetrics | null;
  onRunBenchmark: () => void;
  onScaleCatalog: (targetCount: number) => void;
  t: Record<string, any>;
}

export const HnswBenchmarkCard: React.FC<HnswBenchmarkCardProps> = ({
  catalogLength,
  isScaledCatalog,
  isBenchmarking,
  benchmarkMetrics,
  onRunBenchmark,
  onScaleCatalog,
  t,
}) => {
  return (
    <div className="card p-5 flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start mb-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--text)]">
              {t.benchTitle}
            </h2>
            <p className="text-[0.8125rem] text-[var(--text-sec)] mt-0.5">
              {t.benchSub}
            </p>
          </div>
          <span className="mono text-xs text-[var(--accent)] font-semibold">
            O(log N) ANN
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2.5 p-3 bg-[var(--bg-alt)] rounded-md border border-[var(--border)] mb-3.5 text-xs">
          <div>
            <div className="text-[var(--text-sec)]">{t.benchTopology}</div>
            <div className="mono font-semibold mt-0.5">M=16 · M0=32 · ef=48</div>
          </div>
          <div>
            <div className="text-[var(--text-sec)]">{t.benchStorage}</div>
            <div className="mono font-semibold mt-0.5">Flat Int32Array</div>
          </div>
          <div>
            <div className="text-[var(--text-sec)]">{t.benchActiveCorpus}</div>
            <div className="mono font-semibold mt-0.5">{catalogLength} items (384d)</div>
          </div>
        </div>

        {benchmarkMetrics && (
          <div className="px-3.5 py-3 bg-[var(--success-bg)] border border-[var(--border)] rounded-md mb-3.5 text-[0.8125rem]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 font-semibold text-[var(--success)]">
                <CheckCircle2 size={15} />
                <span>
                  {t.benchVerified} {benchmarkMetrics.totalItems.toLocaleString()} SKU (150 queries)
                </span>
              </div>
              <span className="mono font-bold text-[var(--success)]">
                {benchmarkMetrics.speedup} Speedup
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <div className="text-[0.6875rem] text-[var(--text-sec)]">HNSW p50</div>
                <div className="mono font-bold">{benchmarkMetrics.hnswLatencyMs} ms</div>
              </div>
              <div>
                <div className="text-[0.6875rem] text-[var(--text-sec)]">Linear Scan</div>
                <div className="mono font-bold">{benchmarkMetrics.linearLatencyMs} ms</div>
              </div>
              <div>
                <div className="text-[0.6875rem] text-[var(--text-sec)]">Recall@10</div>
                <div className="mono font-bold">{benchmarkMetrics.recallTopK}%</div>
              </div>
              <div>
                <div className="text-[0.6875rem] text-[var(--text-sec)]">Throughput</div>
                <div className="mono font-bold">{benchmarkMetrics.qpsHnsw.toLocaleString()} QPS</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-primary btn-sm flex-1"
          onClick={onRunBenchmark}
          disabled={isBenchmarking}
        >
          {isBenchmarking ? (
            <>
              <Activity size={14} className="animate-spin" />
              <span>{t.benchRunningBtn}</span>
            </>
          ) : (
            <>
              <Play size={14} />
              <span>{t.benchRunBtn}</span>
            </>
          )}
        </button>
        {!isScaledCatalog && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onScaleCatalog(1200)}
          >
            <span>{t.benchTest1200}</span>
          </button>
        )}
      </div>
    </div>
  );
};
