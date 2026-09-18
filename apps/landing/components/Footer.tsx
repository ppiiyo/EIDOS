import React from 'react';

export function Footer() {
  return (
    <footer className="py-12 px-6 border-t border-slate-900 text-xs text-slate-500 max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
      <div>
        <p>© 2026 EIDOS Recommender Project. Released under the MIT License.</p>
        <p className="mt-1">Built with Fastify, Transformers.js, and TypeScript.</p>
      </div>
      <div className="flex gap-6">
        <a href="https://github.com/ppiiyo/EIDOS" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">
          GitHub
        </a>
        <a href="/docs" className="hover:text-slate-300 transition-colors">
          API Documentation
        </a>
        <a href="/docs/ARCHITECTURE.md" className="hover:text-slate-300 transition-colors">
          Architecture
        </a>
        <a href="/docs/BENCHMARKS.md" className="hover:text-slate-300 transition-colors">
          Benchmarks
        </a>
      </div>
    </footer>
  );
}
