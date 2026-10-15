import React from 'react';
import { Gauge, Clock, Database, ShieldCheck } from 'lucide-react';

export function Metrics() {
  const metrics = [
    {
      icon: Clock,
      value: '14.8 ms',
      label: 'Median Pipeline Latency',
      note: 'Benchmarked on single vCPU Fastify REST node with 1,000 items',
    },
    {
      icon: Gauge,
      value: '980k ops/sec',
      label: 'Dot Product Throughput',
      note: '384-dimensional unit vector dot product execution',
    },
    {
      icon: Database,
      value: '0 Cold-Start Lag',
      label: 'Instant Availability',
      note: 'Embedded immediately on creation without prior user history',
    },
    {
      icon: ShieldCheck,
      value: '100% In-Memory',
      label: 'Data Sovereignty',
      note: 'Runs self-hosted or client-side with zero external telemetry',
    },
  ];

  return (
    <section className="py-20 px-6 max-w-6xl mx-auto border-t border-slate-900">
      <div className="text-center max-w-2xl mx-auto mb-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
          Verified Performance & Latency Metrics
        </h2>
        <p className="mt-3 text-slate-400 text-sm">
          Empirically measured wall-clock latencies without speculative conversion exaggerations.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-xl border border-slate-800 bg-slate-950 p-6 flex flex-col justify-between"
          >
            <div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-cyan-400 w-fit mb-4">
                <m.icon className="w-5 h-5" />
              </div>
              <div className="text-3xl font-bold font-mono text-slate-100">{m.value}</div>
              <div className="text-sm font-medium text-slate-300 mt-1">{m.label}</div>
            </div>
            <p className="text-xs text-slate-500 mt-4 leading-relaxed">{m.note}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
