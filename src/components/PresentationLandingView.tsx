import React, { useState } from 'react';
import {
  Zap,
  Layers,
  Server,
  Cpu,
  HardDrive,
  Shield,
  Check,
  Copy,
  CheckCheck,
  ArrowRight,
  Github,
  Terminal,
  BookOpen,
  Code2,
  ExternalLink,
  Search,
  Sparkles,
} from 'lucide-react';
import { CatalogItem, ActiveTab } from '../types';
import { EidosLogo } from './EidosLogo';

interface PresentationLandingViewProps {
  catalog: CatalogItem[];
  onSelectTab: (tab: ActiveTab) => void;
  onShowToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

type DocsSection =
  | 'introduction'
  | 'quickstart'
  | 'api'
  | 'architecture'
  | 'deployment'
  | 'benchmarks';

export const PresentationLandingView: React.FC<PresentationLandingViewProps> = ({
  catalog,
  onSelectTab,
  onShowToast,
}) => {
  const [activeDocSection, setActiveDocSection] = useState<DocsSection>('quickstart');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [demoQuery, setDemoQuery] = useState<string>('mechanical keyboard');

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    onShowToast('Copied to clipboard', 'success');
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const sampleTypeScriptCode = `import { EidosClient } from '@eidos/sdk';

const client = new EidosClient({
  baseUrl: 'http://localhost:8080',
  apiKey: process.env.EIDOS_API_KEY,
});

// Retrieve semantic recommendations with MMR diversity
const recommendations = await client.recommend({
  itemId: 'prod-001',
  limit: 5,
  minSimilarity: 0.35,
  diversityFactor: 0.7,
});

console.log('Top affinity items:', recommendations);`;

  const sampleCurlCode = `curl -X POST http://localhost:8080/v1/recommend \\
  -H "Content-Type: application/json" \\
  -d '{
    "itemId": "1",
    "limit": 5,
    "diversity": 0.5
  }'`;

  const sampleDockerCode = `docker run -d \\
  -p 8080:8080 \\
  -e NODE_ENV=production \\
  -v $(pwd)/data:/app/data \\
  --name eidos-api \\
  ghcr.io/ppiiyo/eidos-api:latest`;

  const features = [
    {
      title: 'Cold-start elimination',
      description:
        'New items are instantly indexed and discoverable upon ingestion. Zero historical interaction data required.',
      icon: Zap,
    },
    {
      title: 'Diversity balancing',
      description:
        'Maximal Marginal Relevance (MMR) and Shannon entropy prevent recommendation echo-chambers and filter bubbles.',
      icon: Layers,
    },
    {
      title: 'Zero cloud lock-in',
      description:
        '100% self-hostable in Docker, Kubernetes, or bare metal. Your proprietary vectors never leave your infrastructure.',
      icon: Server,
    },
    {
      title: 'Dual execution modes',
      description:
        'Run in-browser via WebAssembly/WebGPU or as a high-throughput microservice in Node.js/Fastify.',
      icon: Cpu,
    },
    {
      title: 'INT8 quantization',
      description:
        '4x memory reduction with accelerated integer dot-product computations for sub-millisecond retrieval.',
      icon: HardDrive,
    },
    {
      title: 'Production ready',
      description:
        'Battle-tested with 134 automated unit & architecture tests, graceful shutdown WAL flush, and OpenTelemetry tracing.',
      icon: Shield,
    },
  ];

  // Filter demo items
  const demoResults = catalog
    .filter((item) => {
      const q = demoQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    })
    .slice(0, 4);

  return (
    <div className="h-full overflow-y-auto bg-white text-[#0A0A0A] font-sans selection:bg-[#2563EB]/15 selection:text-[#0A0A0A]">
      {/* ========================================================================= */}
      {/* 1. HERO SECTION (Stripe / Linear minimal enterprise style) */}
      {/* ========================================================================= */}
      <section className="pt-20 pb-24 px-6 border-b border-[#E5E5E5] bg-white">
        <div className="max-w-4xl mx-auto text-center">
          {/* Release Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#E5E5E5] bg-[#F5F5F5] text-xs font-mono text-[#525252] mb-8 select-none">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
            <span>v2.1.0 released — Production ready</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl font-bold text-[#0A0A0A] tracking-tight leading-[1.1] mb-6">
            Semantic recommendations
            <br />
            <span className="text-[#A3A3A3] font-normal">
              for modern applications
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-[#525252] mb-10 max-w-2xl mx-auto leading-relaxed">
            Real-time vector search engine with cold-start elimination, diversity
            balancing, and zero cloud lock-in.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3.5 justify-center items-center">
            <button
              onClick={() => onSelectTab('recommender')}
              className="w-full sm:w-auto px-7 py-3 bg-[#0A0A0A] hover:bg-[#262626] text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <span>Launch RecSys Console</span>
              <ArrowRight size={15} />
            </button>
            <a
              href="https://github.com/ppiiyo/Eidos"
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto px-7 py-3 border border-[#E5E5E5] hover:bg-[#F5F5F5] text-[#0A0A0A] rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
            >
              <Github size={16} />
              <span>View on GitHub</span>
            </a>
          </div>

          {/* Core Hardware & Benchmarks Stats */}
          <div className="grid grid-cols-3 gap-6 mt-16 pt-12 border-t border-[#E5E5E5]">
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-[#0A0A0A] tracking-tight font-mono">
                0.93µs
              </div>
              <div className="text-xs sm:text-sm text-[#525252] mt-1 font-medium">
                Cosine similarity
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-[#0A0A0A] tracking-tight font-mono">
                14ms
              </div>
              <div className="text-xs sm:text-sm text-[#525252] mt-1 font-medium">
                p50 latency
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-[#0A0A0A] tracking-tight font-mono">
                4x
              </div>
              <div className="text-xs sm:text-sm text-[#525252] mt-1 font-medium">
                Memory compression
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. FEATURES GRID SECTION (Strict, clean card grid) */}
      {/* ========================================================================= */}
      <section className="py-24 px-6 bg-[#FAFAFA] border-b border-[#E5E5E5]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0A0A0A] tracking-tight mb-3">
              Everything you need
            </h2>
            <p className="text-lg text-[#525252] max-w-xl mx-auto">
              Production-grade architecture engineered for deterministic reliability.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="bg-white p-7 rounded-xl border border-[#E5E5E5] hover:border-[#D4D4D8] transition-all shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between"
                >
                  <div>
                    <div className="w-10 h-10 rounded-lg bg-[#F5F5F5] border border-[#E5E5E5] flex items-center justify-center text-[#0A0A0A] mb-5">
                      <Icon size={20} />
                    </div>
                    <h3 className="text-base font-semibold text-[#0A0A0A] mb-2 tracking-tight">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-[#525252] leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. CODE INTEGRATION SECTION */}
      {/* ========================================================================= */}
      <section className="py-24 px-6 bg-white border-b border-[#E5E5E5]">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Narrative */}
            <div className="lg:col-span-5">
              <div className="text-xs font-mono font-semibold uppercase tracking-wider text-[#2563EB] mb-2">
                Developer Ergonomics
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-[#0A0A0A] tracking-tight mb-5">
                Simple, powerful API
              </h2>
              <p className="text-base text-[#525252] mb-8 leading-relaxed">
                Integrate real-time vector recommendations into your product in under five minutes.
                Zero opaque black boxes.
              </p>

              <ul className="space-y-3.5 mb-8 text-sm text-[#262626]">
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#10B981]/15 text-[#10B981] flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                    ✓
                  </span>
                  <span><strong>Type-safe TypeScript SDK</strong> with autocomplete</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#10B981]/15 text-[#10B981] flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                    ✓
                  </span>
                  <span><strong>REST API with OpenAPI / Swagger spec</strong> at <code>/docs</code></span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#10B981]/15 text-[#10B981] flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                    ✓
                  </span>
                  <span><strong>Python ML SDK</strong> for data science workflows</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#10B981]/15 text-[#10B981] flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                    ✓
                  </span>
                  <span><strong>Prometheus & OpenTelemetry</strong> built-in observability</span>
                </li>
              </ul>

              <div className="flex gap-3">
                <button
                  onClick={() => onSelectTab('integration')}
                  className="px-5 py-2.5 bg-[#0A0A0A] hover:bg-[#262626] text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  Explore API Reference
                </button>
              </div>
            </div>

            {/* Right Terminal Mock */}
            <div className="lg:col-span-7">
              <div className="bg-[#0A0A0C] border border-[#26262B] rounded-xl overflow-hidden shadow-2xl">
                {/* Header bar */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#222226] bg-[#121216]">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#EF4444]"></span>
                    <span className="w-3 h-3 rounded-full bg-[#F59E0B]"></span>
                    <span className="w-3 h-3 rounded-full bg-[#10B981]"></span>
                    <span className="ml-2 text-xs font-mono text-[#A3A3A3]">
                      recommendation-pipeline.ts
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(sampleTypeScriptCode, 'hero-code')}
                    className="flex items-center gap-1.5 text-xs text-[#A3A3A3] hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedCode === 'hero-code' ? (
                      <>
                        <CheckCheck size={13} className="text-[#10B981]" />
                        <span className="text-[#10B981]">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Code body */}
                <pre className="p-5 text-xs font-mono text-[#E5E5E5] overflow-x-auto leading-relaxed">
                  <code>{sampleTypeScriptCode}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. DOCUMENTATION SECTION (Stripe / Vercel Docs Layout) */}
      {/* ========================================================================= */}
      <section className="py-20 px-6 bg-[#FAFAFA] border-b border-[#E5E5E5]">
        <div className="max-w-6xl mx-auto">
          <div className="mb-10 text-center sm:text-left">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#0A0A0A] tracking-tight">
              Documentation & Architecture
            </h2>
            <p className="text-sm text-[#525252] mt-1">
              Production deployment guides, API endpoints, and mathematical foundations.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden shadow-sm grid grid-cols-1 md:grid-cols-12 min-h-[520px]">
            {/* Sidebar */}
            <aside className="md:col-span-3 border-b md:border-b-0 md:border-r border-[#E5E5E5] p-4 bg-[#FAFAFA]">
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveDocSection('quickstart')}
                  className={`w-full text-left px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center justify-between ${
                    activeDocSection === 'quickstart'
                      ? 'bg-white text-[#0A0A0A] shadow-xs font-semibold'
                      : 'text-[#525252] hover:bg-[#F5F5F5]'
                  }`}
                >
                  <span>1. Quickstart (Docker)</span>
                  <span className="text-[10px] font-mono text-[#A3A3A3]">5 min</span>
                </button>

                <button
                  onClick={() => setActiveDocSection('api')}
                  className={`w-full text-left px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center justify-between ${
                    activeDocSection === 'api'
                      ? 'bg-white text-[#0A0A0A] shadow-xs font-semibold'
                      : 'text-[#525252] hover:bg-[#F5F5F5]'
                  }`}
                >
                  <span>2. REST API Reference</span>
                  <span className="text-[10px] font-mono text-[#A3A3A3]">v1</span>
                </button>

                <button
                  onClick={() => setActiveDocSection('architecture')}
                  className={`w-full text-left px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center justify-between ${
                    activeDocSection === 'architecture'
                      ? 'bg-white text-[#0A0A0A] shadow-xs font-semibold'
                      : 'text-[#525252] hover:bg-[#F5F5F5]'
                  }`}
                >
                  <span>3. HNSW & Core Math</span>
                  <span className="text-[10px] font-mono text-[#A3A3A3]">ANN</span>
                </button>

                <button
                  onClick={() => setActiveDocSection('deployment')}
                  className={`w-full text-left px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center justify-between ${
                    activeDocSection === 'deployment'
                      ? 'bg-white text-[#0A0A0A] shadow-xs font-semibold'
                      : 'text-[#525252] hover:bg-[#F5F5F5]'
                  }`}
                >
                  <span>4. Production Deployment</span>
                  <span className="text-[10px] font-mono text-[#A3A3A3]">K8s</span>
                </button>

                <button
                  onClick={() => setActiveDocSection('benchmarks')}
                  className={`w-full text-left px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center justify-between ${
                    activeDocSection === 'benchmarks'
                      ? 'bg-white text-[#0A0A0A] shadow-xs font-semibold'
                      : 'text-[#525252] hover:bg-[#F5F5F5]'
                  }`}
                >
                  <span>5. Performance Benchmarks</span>
                  <span className="text-[10px] font-mono text-[#A3A3A3]">Ops</span>
                </button>
              </nav>
            </aside>

            {/* Main Doc Content Pane */}
            <main className="md:col-span-9 p-8 bg-white flex flex-col justify-between">
              {/* Quickstart */}
              {activeDocSection === 'quickstart' && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <div>
                    <h3 className="text-xl font-bold text-[#0A0A0A] tracking-tight">
                      Quickstart Guide
                    </h3>
                    <p className="text-sm text-[#525252] mt-1">
                      Run the containerized Eidos recommendation microservice locally with Docker.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="text-xs font-mono font-medium text-[#262626]">
                      Step 1: Launch microservice container
                    </div>
                    <div className="bg-[#0A0A0C] p-4 rounded-lg font-mono text-xs text-[#E5E5E5] relative group">
                      <code>{sampleDockerCode}</code>
                      <button
                        onClick={() => copyToClipboard(sampleDockerCode, 'doc-docker')}
                        className="absolute top-3 right-3 text-xs text-[#A3A3A3] hover:text-white"
                      >
                        {copiedCode === 'doc-docker' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-xs font-mono font-medium text-[#262626]">
                      Step 2: Query recommendations via cURL
                    </div>
                    <div className="bg-[#0A0A0C] p-4 rounded-lg font-mono text-xs text-[#E5E5E5] relative group">
                      <code>{sampleCurlCode}</code>
                      <button
                        onClick={() => copyToClipboard(sampleCurlCode, 'doc-curl')}
                        className="absolute top-3 right-3 text-xs text-[#A3A3A3] hover:text-white"
                      >
                        {copiedCode === 'doc-curl' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* API Reference */}
              {activeDocSection === 'api' && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <div>
                    <h3 className="text-xl font-bold text-[#0A0A0A] tracking-tight">
                      Core Endpoints
                    </h3>
                    <p className="text-sm text-[#525252] mt-1">
                      RESTful HTTP endpoints documented via OpenAPI 3.0.
                    </p>
                  </div>

                  <div className="border border-[#E5E5E5] rounded-lg divide-y divide-[#E5E5E5] text-xs">
                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded font-mono font-bold bg-[#10B981]/10 text-[#10B981]">
                          POST
                        </span>
                        <code className="font-mono text-[#0A0A0A] font-semibold">
                          /v1/recommend
                        </code>
                      </div>
                      <span className="text-[#525252]">Compute top-K affinity with diversity</span>
                    </div>

                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded font-mono font-bold bg-[#10B981]/10 text-[#10B981]">
                          POST
                        </span>
                        <code className="font-mono text-[#0A0A0A] font-semibold">
                          /v1/search
                        </code>
                      </div>
                      <span className="text-[#525252]">Dense semantic similarity vector search</span>
                    </div>

                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded font-mono font-bold bg-[#2563EB]/10 text-[#2563EB]">
                          GET
                        </span>
                        <code className="font-mono text-[#0A0A0A] font-semibold">
                          /metrics
                        </code>
                      </div>
                      <span className="text-[#525252]">Prometheus telemetry exposition format</span>
                    </div>

                    <div className="p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded font-mono font-bold bg-[#2563EB]/10 text-[#2563EB]">
                          GET
                        </span>
                        <code className="font-mono text-[#0A0A0A] font-semibold">
                          /docs
                        </code>
                      </div>
                      <span className="text-[#525252]">Interactive Swagger UI interface</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Architecture & HNSW */}
              {activeDocSection === 'architecture' && (
                <div className="space-y-4 animate-in fade-in duration-150 text-sm text-[#525252]">
                  <h3 className="text-xl font-bold text-[#0A0A0A] tracking-tight">
                    HNSW & Mathematical Design
                  </h3>
                  <p>
                    Eidos implements a multi-layer Hierarchical Navigable Small World (HNSW) graph
                    with logarithmic search complexity <code>O(log N)</code>.
                  </p>
                  <ul className="list-disc pl-5 space-y-2 text-xs text-[#262626]">
                    <li><strong>Int32 Flattened Addressing:</strong> Replaces pointer-heavy structures to eliminate GC pauses under 1M+ vectors.</li>
                    <li><strong>INT8 Scalar Quantization:</strong> Compresses 384-dimensional Float32 vectors into 8-bit integers with less than 0.5% recall loss.</li>
                    <li><strong>Atomic WAL Persistence:</strong> Write-ahead logging ensures deterministic crash recovery across container restarts.</li>
                  </ul>
                </div>
              )}

              {/* Deployment */}
              {activeDocSection === 'deployment' && (
                <div className="space-y-4 animate-in fade-in duration-150 text-sm text-[#525252]">
                  <h3 className="text-xl font-bold text-[#0A0A0A] tracking-tight">
                    Production Deployment Guide
                  </h3>
                  <p>
                    The API image is packaged as a scratch-based container with minimal footprint,
                    running non-root with resource limits:
                  </p>
                  <div className="bg-[#F5F5F5] border border-[#E5E5E5] p-4 rounded-lg font-mono text-xs text-[#262626]">
                    cpu: "2.0"<br />
                    memory: "1Gi"<br />
                    probes: liveness (/v1/health) & readiness (/v1/health)
                  </div>
                </div>
              )}

              {/* Benchmarks */}
              {activeDocSection === 'benchmarks' && (
                <div className="space-y-4 animate-in fade-in duration-150 text-sm text-[#525252]">
                  <h3 className="text-xl font-bold text-[#0A0A0A] tracking-tight">
                    Empirical Benchmarks
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                    <div className="p-3 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA]">
                      <div className="text-[#A3A3A3]">Throughput (Single Node)</div>
                      <div className="text-lg font-bold text-[#0A0A0A] mt-1">4,200 req/sec</div>
                    </div>
                    <div className="p-3 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA]">
                      <div className="text-[#A3A3A3]">Memory (100k Vectors INT8)</div>
                      <div className="text-lg font-bold text-[#0A0A0A] mt-1">48.2 MB</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Footer link to full API section */}
              <div className="pt-6 border-t border-[#E5E5E5] flex items-center justify-between text-xs text-[#525252]">
                <span>Want to test real queries against the catalog?</span>
                <button
                  onClick={() => onSelectTab('recommender')}
                  className="font-medium text-[#2563EB] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Open RecSys Console</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </main>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. INTERACTIVE DEMO SANDBOX (Live Search Preview) */}
      {/* ========================================================================= */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#0A0A0A] tracking-tight">
              Interactive Test Console
            </h2>
            <p className="text-sm text-[#525252] mt-1">
              Live similarity evaluation against pre-indexed enterprise vectors.
            </p>
          </div>

          <div className="bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl p-6 shadow-sm">
            {/* Search Input Bar */}
            <div className="flex gap-2.5 mb-6">
              <div className="relative flex-1">
                <Search
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A3A3A3]"
                />
                <input
                  type="text"
                  value={demoQuery}
                  onChange={(e) => setDemoQuery(e.target.value)}
                  placeholder="Enter natural language query or concept..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E5E5E5] rounded-lg text-sm text-[#0A0A0A] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                />
              </div>
              <button
                onClick={() => onSelectTab('recommender')}
                className="px-5 py-2.5 bg-[#0A0A0A] hover:bg-[#262626] text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
              >
                Full Console
              </button>
            </div>

            {/* Results Grid */}
            <div className="space-y-2.5">
              {demoResults.map((item) => (
                <div
                  key={item.id}
                  className="bg-white p-4 rounded-lg border border-[#E5E5E5] flex items-center justify-between gap-4 hover:border-[#D4D4D8] transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-[#0A0A0A] truncate">
                        {item.title}
                      </span>
                      <span className="text-xs text-[#525252]">·</span>
                      <span className="text-xs text-[#525252]">{item.category}</span>
                    </div>
                    <p className="text-xs text-[#737373] mt-0.5 line-clamp-1">
                      {item.description}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-[#10B981]">
                      {item.price || '$99.00'}
                    </span>
                    <button
                      onClick={() => onSelectTab('recommender')}
                      className="text-xs text-[#2563EB] hover:underline font-medium cursor-pointer"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. ENTERPRISE FOOTER */}
      {/* ========================================================================= */}
      <footer className="border-t border-[#E5E5E5] py-12 px-6 bg-white text-xs text-[#737373]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <EidosLogo variant="monochrome" size="sm" />
            <span>— Production Semantic RecSys Platform</span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/ppiiyo/Eidos"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#0A0A0A] transition-colors"
            >
              GitHub
            </a>
            <button
              onClick={() => onSelectTab('integration')}
              className="hover:text-[#0A0A0A] transition-colors cursor-pointer"
            >
              API Reference
            </button>
            <button
              onClick={() => onSelectTab('recommender')}
              className="hover:text-[#0A0A0A] transition-colors cursor-pointer"
            >
              Console
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
