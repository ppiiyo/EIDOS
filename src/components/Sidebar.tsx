import React from 'react';
import {
  LayoutDashboard,
  Package,
  Search,
  Lightbulb,
  Boxes,
  Sliders,
  Split,
  MessageSquare,
  BarChart3,
  Rocket,
} from 'lucide-react';
import { MemoryMonitor } from './MemoryMonitor';

export type ViewId =
  | 'dashboard'
  | 'search'
  | 'recommendations'
  | 'vectorspace'
  | 'adaptive'
  | 'catalog'
  | 'abtest'
  | 'conversational'
  | 'analytics'
  | 'launchkit';

const NAV_GROUPS: Array<{
  section: string;
  items: { id: ViewId; label: string; icon: React.FC<any> }[];
}> = [
  {
    section: 'Core Vector Engine',
    items: [
      { id: 'dashboard', label: 'Overview & Benchmark', icon: LayoutDashboard },
      { id: 'search', label: 'Hybrid Search (BM25+HNSW)', icon: Search },
      { id: 'recommendations', label: 'MMR Recommendations', icon: Lightbulb },
      { id: 'vectorspace', label: '3D Space & 2D Graph', icon: Boxes },
      { id: 'adaptive', label: 'Adaptive Lab (AIL)', icon: Sliders },
    ],
  },
  {
    section: 'Data & Experiments',
    items: [
      { id: 'catalog', label: 'Catalog & Bundles', icon: Package },
      { id: 'abtest', label: 'A/B Testing Engine', icon: Split },
      { id: 'conversational', label: 'Vector NLU Agent', icon: MessageSquare },
      { id: 'analytics', label: 'Analytics & Trends', icon: BarChart3 },
      { id: 'launchkit', label: 'Deployment & Docs', icon: Rocket },
    ],
  },
];

interface SidebarProps {
  active: ViewId;
  onNavigate: (id: ViewId) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ active, onNavigate }) => (
  <aside
    style={{
      width: 248,
      minHeight: '100vh',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}
  >
    {/* Brand Zone */}
    <div
      style={{
        height: 56,
        padding: '0 18px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="6" cy="12" r="2.5" fill="var(--accent)" />
        <circle cx="18" cy="6" r="2.5" fill="var(--text)" />
        <circle cx="18" cy="18" r="2.5" fill="var(--text)" />
        <path d="M6 12L18 6M6 12L18 18" stroke="var(--text)" strokeWidth="1.6" />
      </svg>
      <span
        style={{
          fontWeight: 700,
          fontSize: '0.95rem',
          letterSpacing: '-0.02em',
          color: 'var(--text)',
        }}
      >
        Eidos Studio
      </span>
      <span
        className="mono"
        style={{
          marginLeft: 'auto',
          fontSize: '0.6875rem',
          fontWeight: 600,
          color: 'var(--text-sec)',
        }}
      >
        384d
      </span>
    </div>

    {/* Navigation Groups */}
    <nav style={{ padding: '14px 10px', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {NAV_GROUPS.map((group) => (
        <div key={group.section}>
          <div
            style={{
              padding: '0 10px 6px',
              fontSize: '0.6875rem',
              fontWeight: 600,
              color: 'var(--text-mut)',
              letterSpacing: '0.02em',
            }}
          >
            {group.section}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {group.items.map(({ id, label, icon: Icon }) => {
              const isActive = active === id;
              return (
                <button
                  key={id}
                  onClick={() => onNavigate(id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '0.8125rem',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'var(--accent)' : 'var(--text-sec)',
                    background: isActive ? 'var(--accent-bg)' : 'transparent',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background-color 0.12s, color 0.12s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Icon size={15} strokeWidth={isActive ? 2.2 : 1.8} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>

    {/* Real-time V8 Heap Monitor */}
    <div
      style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-alt)',
      }}
    >
      <MemoryMonitor />
    </div>
  </aside>
);
