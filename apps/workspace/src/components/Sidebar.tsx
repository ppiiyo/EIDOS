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
  Database,
  Settings,
  Network,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { UiLanguage, UI_TRANSLATIONS } from '../i18n/uiTranslations';

export type ViewId =
  | 'dashboard'
  | 'demo'
  | 'seo'
  | 'vectorspace'
  | 'adaptive'
  | 'search'
  | 'ranking'
  | 'recommendations'
  | 'catalog'
  | 'indexes'
  | 'cluster'
  | 'analytics'
  | 'abtest'
  | 'conversational'
  | 'settings'
  | 'faq';

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

  const labels =
    uiLang === 'ru'
      ? {
          g1: 'Ядро движка',
          g2: 'Лаборатория и тесты',
          g3: 'Аналитика и эксплуатация',
          demo: 'Демо-каталог (48 SKU)',
          indexes: 'Менеджер индексов HNSW',
          ranking: 'Песочница ранжирования',
          cluster: 'Кластер и отказоустойчивость',
          seo: 'SEO и мерчандайзинг',
          settings: 'Настройки и API-ключи',
          faq: 'FAQ и Гид по функциям',
        }
      : uiLang === 'ja'
      ? {
          g1: 'コアエンジン',
          g2: 'プレイグラウンド & ラボ',
          g3: '分析 & オペレーション',
          demo: 'デモカタログ (48 SKU)',
          indexes: 'インデックス管理',
          ranking: 'ランキング調整ラボ',
          cluster: 'クラスタ & フェイルオーバー',
          seo: 'SEO & マーチャンダイジング',
          settings: '設定 & APIキー',
          faq: 'FAQ & 使い方ガイド',
        }
      : {
          g1: 'Core Engine',
          g2: 'Playground & Labs',
          g3: 'Analytics & Ops',
          demo: 'Demo Catalog (48 SKU)',
          indexes: 'Index Manager',
          ranking: 'Ranking Playground',
          cluster: 'Cluster & Failover',
          seo: 'SEO Insights',
          settings: 'Settings & Keys',
          faq: 'FAQ & Feature Guide',
        };

  const navGroups: Array<{ title: string; items: NavGroupItem[] }> = [
    {
      title: labels.g1,
      items: [
        { id: 'search', label: t.nav.search, emoji: '🔍', icon: Search },
        { id: 'demo', label: labels.demo, emoji: '🎮', icon: Sparkles },
        { id: 'dashboard', label: t.nav.dashboard, emoji: '📊', icon: LayoutDashboard },
        { id: 'catalog', label: t.nav.catalog, emoji: '📦', icon: Package },
        { id: 'indexes', label: labels.indexes, emoji: '🗄️', icon: Database },
        { id: 'recommendations', label: t.nav.recommendations, emoji: '✨', icon: Lightbulb },
      ],
    },
    {
      title: labels.g2,
      items: [
        { id: 'ranking', label: labels.ranking, emoji: '⚖️', icon: Scale },
        { id: 'vectorspace', label: t.nav.vectorspace, emoji: '🌌', icon: Boxes },
        { id: 'conversational', label: t.nav.conversational, emoji: '💬', icon: MessageSquare },
        { id: 'abtest', label: t.nav.abtest, emoji: '🧪', icon: Split },
      ],
    },
    {
      title: labels.g3,
      items: [
        { id: 'cluster', label: labels.cluster, emoji: '🌐', icon: Network },
        { id: 'analytics', label: t.nav.analytics, emoji: '📈', icon: BarChart3 },
        { id: 'seo', label: labels.seo, emoji: '🎯', icon: BarChart3 },
        { id: 'adaptive', label: t.nav.adaptive, emoji: '⚙️', icon: Sliders },
        { id: 'settings', label: labels.settings, emoji: '🔐', icon: Settings },
        { id: 'faq', label: labels.faq, emoji: '❓', icon: HelpCircle },
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
