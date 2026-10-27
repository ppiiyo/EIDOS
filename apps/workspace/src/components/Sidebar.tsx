import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Package,
  Search,
  Lightbulb,
  Split,
  MessageSquare,
  BarChart3,
  Boxes,
  Sliders,
  Terminal,
  Scale,
} from 'lucide-react';
import { UiLanguage, UI_TRANSLATIONS } from '../i18n/uiTranslations';

export type ViewId =
  | 'dashboard'
  | 'seo'
  | 'vectorspace'
  | 'adaptive'
  | 'search'
  | 'ranking'
  | 'recommendations'
  | 'catalog'
  | 'analytics'
  | 'abtest'
  | 'conversational';

export interface SidebarProps {
  active: ViewId;
  onSelect: (id: ViewId) => void;
  onOpenApiModal?: () => void;
  uiLang?: UiLanguage;
}

interface NavGroupItem {
  id: ViewId;
  label: string;
  emoji: string;
  icon: React.FC<{ size?: number }>;
}

export const Sidebar: React.FC<SidebarProps> = ({
  active,
  onSelect,
  onOpenApiModal,
  uiLang = 'ru',
}) => {
  const t = UI_TRANSLATIONS[uiLang];

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('eidos_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem('eidos_sidebar_collapsed', String(isCollapsed));
    } catch {
      // Ignore storage quota errors in restricted environments
    }
  }, [isCollapsed]);

  const navGroups: Array<{ title: string; items: NavGroupItem[] }> = [
    {
      title: 'Core Engine',
      items: [
        { id: 'dashboard', label: t.nav.dashboard, emoji: '📊', icon: LayoutDashboard },
        { id: 'catalog', label: t.nav.catalog, emoji: '📦', icon: Package },
        { id: 'search', label: t.nav.search, emoji: '🔍', icon: Search },
        { id: 'recommendations', label: t.nav.recommendations, emoji: '✨', icon: Lightbulb },
      ],
    },
    {
      title: 'Playground & Labs',
      items: [
        { id: 'ranking', label: 'Ranking Playground', emoji: '⚖️', icon: Scale },
        { id: 'vectorspace', label: t.nav.vectorspace, emoji: '🌌', icon: Boxes },
        { id: 'conversational', label: t.nav.conversational, emoji: '💬', icon: MessageSquare },
        { id: 'abtest', label: t.nav.abtest, emoji: '🧪', icon: Split },
      ],
    },
    {
      title: 'Analytics & Ops',
      items: [
        { id: 'analytics', label: t.nav.analytics, emoji: '📈', icon: BarChart3 },
        { id: 'seo', label: 'SEO Insights', emoji: '🎯', icon: BarChart3 },
        { id: 'adaptive', label: t.nav.adaptive, emoji: '⚙️', icon: Sliders },
      ],
    },
  ];

  return (
    <>
      <button
        type="button"
        className="mobile-menu-toggle"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        aria-label="Toggle Menu"
        data-testid="mobile-menu-toggle"
      >
        ☰
      </button>

      {isMobileOpen && (
        <div
          className="sidebar-overlay"
          data-testid="sidebar-overlay"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}
        aria-label="Primary Navigation"
        data-testid="studio-sidebar"
      >
        <div className="sidebar-header sidebar-brand">
          <div className="sidebar-logo flex items-center gap-2.5">
            <span className="logo-icon">⚡</span>
            {!isCollapsed && <span className="logo-text">EIDOS Engine</span>}
          </div>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            aria-label="Toggle Sidebar"
            data-testid="sidebar-collapse-toggle"
          >
            {isCollapsed ? '»' : '«'}
          </button>
        </div>

        <nav className="sidebar-nav">
          {navGroups.map((group) => (
            <div key={group.title} className="sidebar-group">
              {!isCollapsed && (
                <div className="sidebar-group-title">{group.title}</div>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = active === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`nav-${item.id}`}
                    className={`nav-item sidebar-item ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      onSelect(item.id);
                      setIsMobileOpen(false);
                    }}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <span className="nav-icon" aria-hidden="true">
                      <Icon size={16} />
                    </span>
                    {!isCollapsed && <span className="nav-label">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {onOpenApiModal && (
          <div className="px-2 pb-2">
            <button
              type="button"
              onClick={onOpenApiModal}
              className="btn btn-secondary btn-sm w-full justify-start"
              title={isCollapsed ? t.nav.apiButton : undefined}
            >
              <Terminal size={14} />
              {!isCollapsed && <span>{t.nav.apiButton}</span>}
            </button>
          </div>
        )}

        {!isCollapsed && (
          <div className="sidebar-footer">
            <div className="mono font-semibold text-[var(--text)]">
              {t.nav.engineFooterTitle}
            </div>
            <div className="mt-0.5">{t.nav.engineFooterSub}</div>
          </div>
        )}
      </aside>
    </>
  );
};
