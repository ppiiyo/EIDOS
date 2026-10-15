import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export function Problem() {
  return (
    <section className="py-20 px-6 max-w-6xl mx-auto border-t border-slate-900">
      <div className="text-center max-w-2xl mx-auto mb-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
          The Structural Flaw in Conventional Recommenders
        </h2>
        <p className="mt-3 text-slate-400 text-sm sm:text-base">
          Legacy collaborative filtering relies on historical click logs, while keyword search fails on semantic intent.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* The Problem */}
        <div className="rounded-xl border border-red-500/20 bg-red-950/10 p-6">
          <div className="flex items-center gap-3 mb-4 text-red-400 font-semibold">
            <AlertCircle className="w-5 h-5" />
            <h3>Legacy Approaches (Keywords & History)</h3>
          </div>
          <ul className="space-y-3 text-sm text-slate-300">
            <li className="flex items-start gap-2">
              <span className="text-red-400 font-bold">•</span>
              <span><strong>Cold-Start Starvation:</strong> New inventory receives zero impressions because it lacks prior purchase telemetry.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 font-bold">•</span>
              <span><strong>Keyword Fragility:</strong> Searching for &ldquo;ergonomic typing comfort&rdquo; misses ortholinear keyboards unless exact tags match.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 font-bold">•</span>
              <span><strong>Echo-Chamber Collapsing:</strong> Collaborative filtering repeatedly recommends items the buyer already owns.</span>
            </li>
          </ul>
        </div>

        {/* The EIDOS Solution */}
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/10 p-6">
          <div className="flex items-center gap-3 mb-4 text-cyan-400 font-semibold">
            <CheckCircle2 className="w-5 h-5" />
            <h3>The EIDOS Semantic Representation</h3>
          </div>
          <ul className="space-y-3 text-sm text-slate-300">
            <li className="flex items-start gap-2">
              <span className="text-cyan-400 font-bold">•</span>
              <span><strong>Zero Cold-Start Lag:</strong> New products are embedded immediately on creation and match relevant queries on second zero.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-400 font-bold">•</span>
              <span><strong>Conceptual Vectors:</strong> Products cluster based on functional intent and shared semantics across descriptions.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-400 font-bold">•</span>
              <span><strong>Entropy-Balanced Discovery:</strong> Maximum Marginal Relevance guarantees cross-category catalog exploration.</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
