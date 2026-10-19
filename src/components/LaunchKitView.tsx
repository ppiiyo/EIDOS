import React, { useState } from 'react';
import { Rocket, Copy, Check, Terminal, Settings, Shield } from 'lucide-react';

type TabId = 'quickstart' | 'env' | 'docker' | 'checklist';

const TABS: { id: TabId; label: string; icon: React.FC<any> }[] = [
  { id: 'quickstart', label: 'Quick Start',   icon: Rocket },
  { id: 'env',        label: 'Environment',   icon: Settings },
  { id: 'docker',     label: 'Docker',        icon: Terminal },
  { id: 'checklist',  label: 'Checklist',     icon: Shield },
];

export const LaunchKitView: React.FC = () => {
  const [tab, setTab] = useState<TabId>('quickstart');
  const [copied, setCopied] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  const copy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const CodeBlock = ({ id, code }: { id: string; code: string; lang?: string }) => (
    <div style={{ position:'relative' }}>
      <button onClick={() => copy(id, code)}
        style={{
          position:'absolute', top:8, right:8,
          background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.2)',
          borderRadius:6, padding:'4px 8px', cursor:'pointer',
          color:'#fff', fontSize:'0.75rem', display:'flex', alignItems:'center', gap:4,
        }}>
        {copied === id ? <><Check size={12}/> Copied</> : <><Copy size={12}/> Copy</>}
      </button>
      <pre style={{
        background:'#1E1E2E', color:'#CDD6F4', borderRadius:8,
        padding:'16px 16px 16px 20px', overflow:'auto',
        fontSize:'0.8125rem', lineHeight:1.6, fontFamily:'var(--font-mono)',
      }}>
        {code}
      </pre>
    </div>
  );

  const CHECKLIST_ITEMS = [
    { id: 'env',      label: 'Set EIDOS_API_KEY (min 32 characters)' },
    { id: 'port',     label: 'Configure PORT and HOST environment variables' },
    { id: 'cors',     label: 'Review CORS origins for production domain' },
    { id: 'rate',     label: 'Set rate limiting thresholds' },
    { id: 'logging',  label: 'Configure log level to "info" for production' },
    { id: 'https',    label: 'Enable HTTPS / TLS termination' },
    { id: 'backup',   label: 'Set up data backup strategy' },
    { id: 'monitor',  label: 'Configure health check monitoring' },
    { id: 'catalog',  label: 'Import production catalog data' },
    { id: 'test',     label: 'Run integration tests against staging' },
  ];

  return (
    <div className="page">
      <div style={{ marginBottom:24 }}>
        <h1 className="page-title">Launch Kit</h1>
        <p className="page-sub">Everything you need to deploy Eidos to production</p>
      </div>

      {/* Табы */}
      <div style={{ display:'flex', gap:2, marginBottom:20, borderBottom:'1px solid var(--border)' }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            style={{
              display:'flex', alignItems:'center', gap:6,
              padding:'8px 16px', fontSize:'0.875rem', fontWeight: tab===id?600:400,
              color: tab===id ? 'var(--accent)' : 'var(--text-sec)',
              background:'none', border:'none', cursor:'pointer',
              borderBottom: tab===id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom:-1,
            }}>
            <Icon size={14}/>{label}
          </button>
        ))}
      </div>

      {/* Quick Start */}
      {tab === 'quickstart' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {[
            { step:'1', title:'Clone and install', code:`git clone https://github.com/ppiiyo/Eidos.git\ncd eidos\npnpm install` },
            { step:'2', title:'Start development server', code:`pnpm dev` },
            { step:'3', title:'Build for production', code:`pnpm build` },
            { step:'4', title:'Run API server', code:`cd apps/api\nEIDOS_API_KEY=your-secret-key node dist/server.js` },
          ].map(({ step, title, code }) => (
            <div key={step}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <span style={{
                  width:24, height:24, borderRadius:'50%', background:'#111827',
                  color:'#fff', fontSize:'0.75rem', fontWeight:700,
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}>{step}</span>
                <span style={{ fontWeight:600, fontSize:'0.9375rem' }}>{title}</span>
              </div>
              <CodeBlock id={`qs-${step}`} code={code}/>
            </div>
          ))}
        </div>
      )}

      {/* Environment */}
      {tab === 'env' && (
        <div className="card" style={{ padding:20 }}>
          <h2 style={{ fontSize:'0.9375rem', fontWeight:600, marginBottom:16 }}>
            Required environment variables
          </h2>
          <CodeBlock id="env-vars" code={`# Server
PORT=8080
HOST=0.0.0.0
NODE_ENV=production

# Authentication (min 32 characters)
EIDOS_API_KEY=your-production-api-key-here

# Adaptive Intelligence Layer (optional)
AIL_ENABLED=true
AIL_ALPHA=0.5
AIL_BETA=0.3

# Rate limiting
RATE_LIMIT_MAX=1200
RATE_LIMIT_WINDOW=60000

# Logging
LOG_LEVEL=info`}/>
          <div style={{ marginTop:16, padding:'12px 16px', background:'var(--warning-bg)',
            borderRadius:8, fontSize:'0.8125rem', color:'var(--warning)' }}>
            Never commit <code>.env</code> files to version control. Use secrets management in production.
          </div>
        </div>
      )}

      {/* Docker */}
      {tab === 'docker' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div>
            <h2 style={{ fontSize:'0.9375rem', fontWeight:600, marginBottom:8 }}>Build and run</h2>
            <CodeBlock id="docker-run" code={`# Build image
docker build -t eidos-api ./apps/api

# Run container
docker run -d \\
  --name eidos \\
  -p 8080:8080 \\
  -e NODE_ENV=production \\
  -e EIDOS_API_KEY=your-secret-key \\
  eidos-api`}/>
          </div>
          <div>
            <h2 style={{ fontSize:'0.9375rem', fontWeight:600, marginBottom:8 }}>Health check</h2>
            <CodeBlock id="docker-health" code={`curl http://localhost:8080/v1/health
# Expected: {"status":"ok","items":0,"uptime":...}`}/>
          </div>
        </div>
      )}

      {/* Checklist */}
      {tab === 'checklist' && (
        <div className="card" style={{ padding:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
            <h2 style={{ fontSize:'0.9375rem', fontWeight:600 }}>
              Production readiness checklist
            </h2>
            <span className="badge badge-accent">
              {Object.values(checklist).filter(Boolean).length}/{CHECKLIST_ITEMS.length} done
            </span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
            {CHECKLIST_ITEMS.map(({ id, label }) => (
              <label key={id} style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'10px 12px', borderRadius:8, cursor:'pointer',
                background: checklist[id] ? 'var(--success-bg)' : 'transparent',
                transition:'background .15s',
              }}>
                <input type="checkbox" checked={!!checklist[id]}
                  onChange={() => setChecklist(c => ({...c, [id]: !c[id]}))}
                  style={{ width:16, height:16, accentColor:'var(--success)' }}/>
                <span style={{
                  fontSize:'0.875rem',
                  textDecoration: checklist[id] ? 'line-through' : 'none',
                  color: checklist[id] ? 'var(--text-mut)' : 'var(--text)',
                }}>{label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
