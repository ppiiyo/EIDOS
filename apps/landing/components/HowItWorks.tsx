import React from 'react';
import { Layers, Network, Compass } from 'lucide-react';

export function HowItWorks() {
  const steps = [
    {
      icon: Layers,
      step: '01',
      title: 'Contextual Ingestion',
      desc: 'Title, category, tags, and product descriptions are concatenated and transformed into 384-dimensional dense vectors using all-MiniLM-L6-v2.',
    },
    {
      icon: Network,
      step: '02',
      title: 'L2 Cosine Metric Matrix',
      desc: 'Unit-normalized vectors allow cosine similarity to be computed as rapid dot products, evaluating affinity across 10,000 items in ~3.1 milliseconds.',
    },
    {
      icon: Compass,
      step: '03',
      title: 'MMR & Shannon Diversity',
      desc: 'The ranking pipeline evaluates Maximum Marginal Relevance, penalizing redundant items to surface diverse, complementary recommendations.',
    },
  ];

  return (
    <section className="py-20 px-6 max-w-6xl mx-auto border-t border-slate-900">
      <div className="text-center max-w-2xl mx-auto mb-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
          How the Pipeline Operates
        </h2>
        <p className="mt-3 text-slate-400 text-sm sm:text-base">
          Deterministic vector algebra executed in-memory or directly inside client WebAssembly.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {steps.map((s) => (
          <div
            key={s.step}
            className="rounded-xl border border-slate-800 bg-slate-950 p-6 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-cyan-400">
                  <s.icon className="w-5 h-5" />
                </div>
                <span className="font-mono text-sm text-slate-500 font-bold">{s.step}</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-100 mb-2">{s.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
