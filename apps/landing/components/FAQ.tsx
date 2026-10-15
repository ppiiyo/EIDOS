import React from 'react';

export function FAQ() {
  const faqs = [
    {
      q: 'How does EIDOS handle the cold-start problem for new items?',
      a: 'Unlike collaborative filtering that requires purchase history, EIDOS generates dense vector embeddings immediately upon catalog ingestion. As soon as a product is saved, it is fully discoverable via semantic similarity and natural language search.',
    },
    {
      q: 'Can EIDOS run entirely on the client without a backend server?',
      a: 'Yes. The demo application uses Transformers.js to execute all-MiniLM-L6-v2 directly inside the browser using WebAssembly and WebGL. Models are cached in the browser IndexedDB, eliminating repeated downloads.',
    },
    {
      q: 'How does MMR diversity prevention work?',
      a: 'Maximum Marginal Relevance balances direct semantic proximity with distance from already selected recommendations. This prevents the engine from returning five almost identical items and instead surfaces complementary accessories and related products.',
    },
    {
      q: 'What are the hardware requirements for the REST API?',
      a: 'For catalogs under 25,000 items, a single container with 1 vCPU and 1GB RAM is sufficient to maintain sub-25ms response times. For enterprise catalogs exceeding 1,000,000 items, EIDOS interfaces with Qdrant or Milvus HNSW clusters.',
    },
  ];

  return (
    <section className="py-20 px-6 max-w-4xl mx-auto border-t border-slate-900">
      <div className="text-center mb-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
          Frequently Answered Architectural Questions
        </h2>
      </div>

      <div className="space-y-6">
        {faqs.map((faq) => (
          <div
            key={faq.q}
            className="rounded-xl border border-slate-800/80 bg-slate-950 p-6 text-left"
          >
            <h3 className="font-semibold text-slate-100 text-base mb-2">{faq.q}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{faq.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
