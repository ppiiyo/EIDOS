import React from 'react';
import { Check } from 'lucide-react';

export function Pricing() {
  const tiers = [
    {
      name: 'Open Source / Self-Hosted',
      price: '$0',
      period: 'forever',
      desc: 'Full access to core repository, WASM models, and Fastify server.',
      features: [
        'MIT Licensed source code',
        'In-browser client WASM execution',
        'Standalone Fastify REST Docker container',
        'Community GitHub support',
      ],
      cta: 'Deploy Self-Hosted',
      popular: false,
    },
    {
      name: 'Managed Cloud API',
      price: '$49',
      period: 'per month',
      desc: 'High-availability hosted vector cluster with automatic updates.',
      features: [
        'Up to 100,000 catalog items',
        '1,200 requests / minute rate limit',
        'Sub-20ms multi-region CDN latency',
        'API Key dashboard & telemetry',
        'Email & Discord technical support',
      ],
      cta: 'Start 14-Day Evaluation',
      popular: true,
    },
    {
      name: 'Enterprise Dedicated',
      price: 'Custom',
      period: 'annual agreement',
      desc: 'Dedicated Kubernetes cluster with custom fine-tuned embedding models.',
      features: [
        'Millions of items with Qdrant cluster',
        'Custom domain-specific fine-tuning',
        'Air-gapped on-premise deployment',
        '99.99% SLA agreement',
        'Dedicated Solutions Architect',
      ],
      cta: 'Contact Architecture Team',
      popular: false,
    },
  ];

  return (
    <section className="py-20 px-6 max-w-6xl mx-auto border-t border-slate-900">
      <div className="text-center max-w-2xl mx-auto mb-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
          Transparent Deployment Options
        </h2>
        <p className="mt-3 text-slate-400 text-sm">
          Run 100% free and open-source on your own hardware, or leverage our managed low-latency cluster.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={`rounded-xl p-6 flex flex-col justify-between ${
              t.popular
                ? 'border-2 border-cyan-500 bg-slate-900/90 shadow-xl shadow-cyan-500/10'
                : 'border border-slate-800 bg-slate-950'
            }`}
          >
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold text-slate-100">{t.name}</h3>
                {t.popular && (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-bold">
                    Recommended
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mb-6">{t.desc}</p>
              <div className="mb-6">
                <span className="text-4xl font-bold font-mono text-slate-100">{t.price}</span>
                <span className="text-xs text-slate-500 ml-2">/ {t.period}</span>
              </div>
              <ul className="space-y-3 text-xs text-slate-300 mb-8">
                {t.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              className={`w-full py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                t.popular
                  ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800'
              }`}
            >
              {t.cta}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
