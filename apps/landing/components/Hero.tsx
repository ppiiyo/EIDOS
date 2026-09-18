'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Terminal, Cpu } from 'lucide-react';

export function Hero() {
  return (
    <section className="relative pt-24 pb-20 px-6 max-w-6xl mx-auto text-center">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-xs font-mono mb-8"
      >
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        v1.0 Production Architecture • Open Source MIT
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="text-4xl sm:text-6xl font-bold tracking-tight text-slate-100 max-w-4xl mx-auto leading-tight"
      >
        Semantic Recommendations Driven by{' '}
        <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          Conceptual Meaning
        </span>
        , Not Just Keywords
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mt-6 text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed"
      >
        Deliver high-affinity product discovery for marketplaces, digital libraries, and platforms using
        384-dimensional vector embeddings with zero cold-start latency.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mt-10 flex flex-wrap justify-center gap-4"
      >
        <a
          href="/demo"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm transition-colors shadow-lg shadow-cyan-500/20"
        >
          Explore Live Demo
          <ArrowRight className="w-4 h-4" />
        </a>
        <a
          href="https://github.com/ppiiyo/EIDOS"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-200 font-medium text-sm transition-colors"
        >
          <Terminal className="w-4 h-4 text-purple-400" />
          GitHub Repository
        </a>
      </motion.div>

      {/* Terminal Preview Card */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="mt-16 mx-auto max-w-3xl rounded-xl border border-slate-800 bg-slate-950/80 shadow-2xl p-4 text-left font-mono text-xs overflow-hidden"
      >
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500/80" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
            <span className="ml-2 text-slate-400">bash — curl /v1/recommend</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <Cpu className="w-3.5 h-3.5" />
            <span>sub-20ms inference</span>
          </div>
        </div>
        <pre className="text-slate-300 leading-relaxed overflow-x-auto">
          <code>{`$ curl -X POST https://api.eidos.dev/v1/recommend \\
  -H "Authorization: Bearer eidos_live_sk94829a8f" \\
  -d '{"itemId": "prod-402", "limit": 2, "diversityFactor": 0.75}'

{
  "sourceItemId": "prod-402",
  "recommendations": [
    { "id": "prod-118", "score": 0.884, "title": "Ergonomic Mechanical Keyboard" },
    { "id": "prod-209", "score": 0.763, "title": "Ultra-Wide Monitor Light Bar" }
  ],
  "latencyMs": 14.8,
  "entropy": 1.521
}`}</code>
        </pre>
      </motion.div>
    </section>
  );
}
