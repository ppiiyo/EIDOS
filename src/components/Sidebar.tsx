import React from 'react';
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
} from 'lucide-react';
import { UiLanguage, UI_TRANSLATIONS } from '../i18n/uiTranslations';

export type ViewId =
  | 'dashboard'
  | 'vectorspace'
  | 'adaptive'
  | 'search'
  | 'recommendations'
  | 'catalog'
  | 'analytics'
  | 'abtest'
  | 'conversational';

interface SidebarProps {
  active: ViewId;
  onSelect: (id: ViewId) => void;
  onOpenApiModal?: () => void;
  uiLang?: UiLanguage;
}

export const Sidebar: React.FC<SidebarProps> = ({
  active,
  onSelect,
  onOpenApiModal,
  uiLang = 'ru',
}) => {
  const t = UI_TRANSLATIONS[uiLang];

  const NAV_SECTIONS: Array<{
    title: string;
    items: Array<{ id: ViewId; label: string; icon: React.FC<{ size?: number }> }>;
  }> = [
    {
      title: t.nav.coreEngine,
      items: [
        { id: 'dashboard', label: t.nav.dashboard, icon: LayoutDashboard },
        { id: 'vectorspace', label: t.nav.vectorspace, icon: Boxes },
        { id: 'adaptive', label: t.nav.adaptive, icon: Sliders },
        { id: 'search', label: t.nav.search, icon: Search },
        { id: 'recommendations', label: t.nav.recommendations, icon: Lightbulb },
      ],
    },
    {
      title: t.nav.intelligenceOperations,
      items: [
        { id: 'catalog', label: t.nav.catalog, icon: Package },
        { id: 'analytics', label: t.nav.analytics, icon: BarChart3 },
        { id: 'abtest', label: t.nav.abtest, icon: Split },
        { id: 'conversational', label: t.nav.conversational, icon: MessageSquare },
      ],
    },
  ];

  return (
    <aside className="sidebar" aria-label="Primary Navigation">
      <div className="sidebar-brand">
        <div className="sidebar-brand-dot" />
        <span>Eidos Engine</span>
        <span
          className="mono"
          style={{
            marginLeft: 'auto',
            fontSize: '0.6875rem',
            color: 'var(--text-sec)',
            fontWeight: 500,
          }}
        >
          v2.5
        </span>
      </div>

      <nav className="sidebar-nav">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} style={{ marginBottom: 14 }}>
            <div
              style={{
                padding: '6px 12px 4px',
                fontSize: '0.6875rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-mut)',
              }}
            >
              {section.title}
            </div>
            {section.items.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                data-testid={`nav-${id}`}
                onClick={() => onSelect(id)}
                className={`sidebar-item ${active === id ? 'active' : ''}`}
              >
                <Icon size={16} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      {onOpenApiModal && (
        <div style={{ padding: '0 8px 8px' }}>
          <button
            type="button"
            onClick={onOpenApiModal}
            className="btn btn-secondary btn-sm"
            style={{ width: '100%', justifyContent: 'flex-start' }}
          >
            <Terminal size={14} />
            <span>{t.nav.apiButton}</span>
          </button>
        </div>
      )}

      <div className="sidebar-footer">
        <div className="mono" style={{ fontWeight: 600, color: 'var(--text)' }}>
          {t.nav.engineFooterTitle}
        </div>
        <div style={{ marginTop: 2 }}>{t.nav.engineFooterSub}</div>
      </div>
    </aside>
  );
};
