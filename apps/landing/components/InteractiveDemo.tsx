'use client';

import React, { useState } from 'react';
import { Search, Sparkles } from 'lucide-react';

interface MockItem {
  id: string;
  title: string;
  category: string;
  score: number;
}

export function InteractiveDemo() {
  const [query, setQuery] = useState('ergonomic desk posture comfort');
  const [results, setResults] = useState<MockItem[]>([
    { id: '1', title: 'Ortholinear Split Mechanical Keyboard', category: 'Electronics', score: 0.89 },
    { id: '2', title: 'Walnut Palm Rest Cushion', category: 'Accessories', score: 0.81 },
    { id: '3', title: 'Adjustable Gas-Spring Monitor Arm', category: 'Office', score: 0.76 },
  ]);

  const handleSimulate = () => {
    if (query.toLowerCase().includes('light') || query.toLowerCase().includes('screen')) {
      setResults([
        { id: '4', title: 'Anti-Glare Monitor Light Bar', category: 'Office', score: 0.91 },
        { id: '5', title: 'Polarized Screen Blue-Light Filter', category: 'Accessories', score: 0.84 },
      ]);
    } else if (query.toLowerCase().includes('sound') || query.toLowerCase().includes('noise') || query.toLowerCase().includes('headphone')) {
      setResults([
        { id: '6', title: 'Over-Ear Active Hybrid ANC Headphones', category: 'Audio', score: 0.93 },
        { id: '7', title: 'Acoustic Desk Partition Panel', category: 'Office', score: 0.79 },
      ]);
    } else {
      setResults([
        { id: '1', title: 'Ortholinear Split Mechanical Keyboard', category: 'Electronics', score: 0.89 },
        { id: '2', title: 'Walnut Palm Rest Cushion', category: 'Accessories', score: 0.81 },
        { id: '3', title: 'Adjustable Gas-Spring Monitor Arm', category: 'Office', score: 0.76 },
      ]);
    }
  };

  return (
    <section className="py-20 px-6 max-w-5xl mx-auto border-t border-slate-900">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
          Interactive Vector Query Simulator
        </h2>
        <p className="mt-3 text-slate-400 text-sm">
          Test semantic mapping across conceptual terms without requiring keyword matches.
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-xl">
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Try 'eye strain late night' or 'silent focus acoustics'..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>
          <button
            onClick={handleSimulate}
            className="px-5 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm transition-colors flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Compute
          </button>
        </div>

        <div className="space-y-3">
          {results.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3.5 rounded-lg border border-slate-800 bg-slate-900/60"
            >
              <div>
                <h4 className="text-sm font-medium text-slate-200">{item.title}</h4>
                <span className="text-xs text-slate-500">{item.category}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 bg-slate-800 h-2 rounded-full overflow-hidden hidden sm:block">
                  <div
                    className="bg-cyan-400 h-full rounded-full"
                    style={{ width: `${item.score * 100}%` }}
                  />
                </div>
                <span className="font-mono text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 px-2 py-0.5 rounded">
                  {Math.round(item.score * 100)}% match
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
