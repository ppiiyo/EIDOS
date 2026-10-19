import React from 'react';
import {
  LayoutDashboard,
  Package,
  Search,
  Lightbulb,
  Split,
  MessageSquare,
  BarChart3,
  Rocket,
} from 'lucide-react';
import { MemoryMonitor } from './MemoryMonitor';

export type ViewId =
  | 'dashboard'
  | 'catalog'
  | 'search'
  | 'recommendations'
  | 'abtest'
  | 'conversational'
  | 'analytics'
  | 'launchkit';

const NAV: { id: ViewId; label: string; icon: React.FC<any> }[] = [
  { id: 'dashboard',      label: 'Dashboard',       icon: LayoutDashboard },
  { id: 'catalog',        label: 'Catalog',         icon: Package },
  { id: 'search',         label: 'Search',          icon: Search },
  { id: 'recommendations',label: 'Recommendations', icon: Lightbulb },
  { id: 'abtest',         label: 'A/B Testing',     icon: Split },
  { id: 'conversational', label: 'Conversational',  icon: MessageSquare },
  { id: 'analytics',      label: 'Analytics',       icon: BarChart3 },
  { id: 'launchkit',      label: 'Launch Kit',      icon: Rocket },
];

interface SidebarProps {
  active: ViewId;
  onNavigate: (id: ViewId) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ active, onNavigate }) => (
  <aside style={{
    width: 230, minHeight: '100vh',
    background: '#fff', borderRight: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', flexShrink: 0,
  }}>
    {/* Логотип */}
    <div style={{
      padding: '20px 16px', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="6" cy="12" r="2.5" fill="#111827"/>
        <circle cx="18" cy="6"  r="2.5" fill="#111827"/>
        <circle cx="18" cy="18" r="2.5" fill="#111827"/>
        <path d="M6 12L18 6M6 12L18 18" stroke="#111827" strokeWidth="1.5"/>
      </svg>
      <span style={{ fontWeight: 700, fontSize: '0.9375rem', letterSpacing: '-.01em', color: '#111827' }}>
        kostra44SIP
      </span>
      <span style={{
        marginLeft: 'auto',
        fontSize: '0.6875rem',
        fontWeight: 600,
        color: 'var(--accent)',
        background: 'var(--accent-bg)',
        padding: '2px 6px',
        borderRadius: 4,
      }}>
        v3.0
      </span>
    </div>

    {/* Навигация */}
    <nav style={{ padding: '12px 8px', flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {NAV.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '8px 12px',
              fontSize: '0.875rem', fontWeight: isActive ? 600 : 400,
              color: isActive ? '#111827' : '#6B7280',
              background: isActive ? '#F3F4F6' : 'transparent',
              border: 'none', borderRadius: 6, cursor: 'pointer',
              textAlign: 'left', transition: 'background .12s, color .12s',
            }}
          >
            <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>

    {/* Real-time Memory Monitor and System Specs */}
    <div style={{
      padding: '12px 16px',
      borderTop: '1px solid var(--border)',
      background: 'var(--bg-alt)',
    }}>
      <MemoryMonitor />
    </div>
  </aside>
);
