import React, { useState, useMemo } from 'react';
import { HelpCircle, Search, ArrowRight, CheckCircle2, Sparkles, BookOpen, MessageCircleQuestion, Globe } from 'lucide-react';
import { ViewId } from './Sidebar';
import { AUDIENCE_FILTERS, FEATURE_GUIDE_ITEMS, FaqAudienceId } from '../data/faqGuideData';
import { FAQ_QUESTIONS_DATA } from '../data/faqQuestionsData';

export interface FaqGuideViewProps {
  uiLang?: 'ru' | 'en' | 'ja';
  onNavigate?: (view: ViewId) => void;
  onOpenDatabaseConnector?: () => void;
}

export const FaqGuideView: React.FC<FaqGuideViewProps> = ({
  uiLang = 'ru',
  onNavigate,
  onOpenDatabaseConnector,
}) => {
  const isRu = uiLang === 'ru';
  const langKey: 'ru' | 'en' = isRu ? 'ru' : 'en';

  const [activeSection, setActiveSection] = useState<'features' | 'questions'>('features');
  const [audienceFilter, setAudienceFilter] = useState<FaqAudienceId>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(FAQ_QUESTIONS_DATA[0]?.id ?? null);

  const filteredFeatures = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return FEATURE_GUIDE_ITEMS;
    return FEATURE_GUIDE_ITEMS.filter(
      (item) =>
        item.title[langKey].toLowerCase().includes(q) ||
        item.whatIsIt[langKey].toLowerCase().includes(q) ||
        item.whyNeeded[langKey].toLowerCase().includes(q) ||
        item.howItWorks[langKey].toLowerCase().includes(q) ||
        item.realExample[langKey].toLowerCase().includes(q)
    );
  }, [searchQuery, langKey]);

  const filteredQuestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return FAQ_QUESTIONS_DATA.filter((item) => {
      const matchesAudience = audienceFilter === 'all' || item.audience === audienceFilter;
      if (!matchesAudience) return false;
      if (!q) return true;
      return (
        item.question[langKey].toLowerCase().includes(q) ||
        item.shortAnswer[langKey].toLowerCase().includes(q) ||
        item.businessImpact[langKey].toLowerCase().includes(q) ||
        item.detailedSteps[langKey].some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [audienceFilter, searchQuery, langKey]);

  return (
    <div className="page" data-testid="faq-guide-view">
      <div className="card px-6 py-5 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="badge badge-accent">
                <HelpCircle size={13} />
                <span>{isRu ? 'База знаний для бизнеса, SEO и SMM' : 'Business, SEO & SMM Guide'}</span>
              </span>
              <span className="badge badge-success">{isRu ? 'Простыми словами без кода' : 'Plain-Language Overview'}</span>
            </div>
            <h1 className="page-title m-0 text-[1.375rem]">
              {isRu ? 'FAQ и Подробный гид по функциям платформы' : 'FAQ & Complete Platform Feature Guide'}
            </h1>
            <p className="page-sub mt-1 max-w-3xl">
              {isRu
                ? 'Наглядное руководство для SEO-специалистов, SMM-менеджеров, таргетологов, маркетологов и владельцев магазинов: зачем нужна каждая вкладка, какую пользу она приносит и как всё устроено.'
                : 'Clear, practical guide for SEO managers, SMM specialists, merchandisers, and store owners explaining what every feature does and why it matters.'}
            </p>
          </div>
          {onOpenDatabaseConnector && (
            <button type="button" onClick={onOpenDatabaseConnector} className="btn btn-primary btn-sm">
              <Globe size={14} />
              <span>{isRu ? 'Подключить к 1С-Битрикс / Сайту' : 'Connect to 1C-Bitrix / Store'}</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-3 border-t border-[var(--border)]">
          <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--bg-alt)]">
            <div className="flex items-center gap-2 mb-1">
              <span className="badge badge-error">{isRu ? 'Обычный поиск на сайтах' : 'Standard Website Search'}</span>
            </div>
            <p className="text-xs text-[var(--text-sec)] m-0 leading-relaxed">
              {isRu
                ? 'Ищет только буквальное совпадение букв. Покупатель из рекламы пишет «тёплая кофта в поход» или «уши с шумодавом», а в каталоге написано «Толстовка флисовая» и «Наушники ANC». Итог: «Найдено 0 товаров», клиент уходит, рекламный бюджет теряется.'
                : 'Matches only exact letters. If a shopper types "noise blocker for flights" and your catalog says "ANC Headphones", standard search returns "0 results" and loses the sale.'}
            </p>
          </div>

          <div className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--bg-alt)]">
            <div className="flex items-center gap-2 mb-1">
              <span className="badge badge-success">{isRu ? 'Умный поиск и мерчандайзинг EIDOS' : 'EIDOS Smart Search & Merchandising'}</span>
            </div>
            <p className="text-xs text-[var(--text-sec)] m-0 leading-relaxed">
              {isRu
                ? 'Понимает человеческий смысл, синонимы, сленг и задачу покупателя + точно ищет по артикулам. Позволяет маркетологу ползунками поднимать в ТОП товары с высокой маржой (прибылью) и новинки, а SEO-специалисту показывает реальные запросы людей.'
                : 'Understands human meaning, synonyms, slang, and exact SKUs simultaneously. Lets marketers boost high-margin items with sliders and gives SEO teams full visibility into customer queries.'}
            </p>
          </div>
        </div>
      </div>

      <div className="card px-4 py-3 mb-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            data-testid="faq-tab-features"
            onClick={() => setActiveSection('features')}
            className={activeSection === 'features' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
          >
            <BookOpen size={14} />
            <span>{isRu ? `Обзор всех вкладок проекта (${FEATURE_GUIDE_ITEMS.length})` : `All Studio Tabs Explained (${FEATURE_GUIDE_ITEMS.length})`}</span>
          </button>
          <button
            type="button"
            data-testid="faq-tab-questions"
            onClick={() => setActiveSection('questions')}
            className={activeSection === 'questions' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
          >
            <MessageCircleQuestion size={14} />
            <span>{isRu ? `Частые вопросы: SEO, SMM, Продажи, Битрикс (${FAQ_QUESTIONS_DATA.length})` : `Role-Based FAQ: SEO, SMM, Sales & Bitrix (${FAQ_QUESTIONS_DATA.length})`}</span>
          </button>
        </div>

        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-mut)] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isRu ? 'Поиск по функциям и вопросам (маржа, SEO, SMM, Битрикс)...' : 'Search features or questions (margin, SEO, SMM, Bitrix)...'}
            className="input pl-8 py-1.5 text-xs"
          />
        </div>
      </div>

      {activeSection === 'features' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="faq-features-grid">
          {filteredFeatures.map((feat) => (
            <div key={feat.id} className="card p-5 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span className="text-xl leading-none mt-0.5">{feat.emoji}</span>
                    <div>
                      <span className="badge badge-accent mb-1">{feat.badge[langKey]}</span>
                      <h3 className="text-[0.9375rem] font-semibold text-[var(--text)] m-0">{feat.title[langKey]}</h3>
                    </div>
                  </div>
                  {onNavigate && (
                    <button type="button" onClick={() => onNavigate(feat.id)} className="btn btn-secondary btn-sm">
                      <span>{isRu ? 'Открыть' : 'Open'}</span>
                      <ArrowRight size={12} />
                    </button>
                  )}
                </div>

                <div className="space-y-2 text-xs leading-relaxed">
                  <div className="p-3 rounded-md border border-[var(--border)] bg-[var(--bg-alt)]">
                    <div className="font-semibold text-[var(--text)] mb-0.5">{isRu ? 'Что это простыми словами:' : 'What It Is (In Plain Words):'}</div>
                    <p className="text-[var(--text-sec)] m-0">{feat.whatIsIt[langKey]}</p>
                  </div>
                  <div className="p-3 rounded-md border border-[var(--border)] bg-[var(--bg-alt)]">
                    <div className="font-semibold text-[var(--text)] mb-0.5">{isRu ? 'Зачем нужна эта функция (Польза):' : 'Why You Need It (Business Value):'}</div>
                    <p className="text-[var(--text-sec)] m-0">{feat.whyNeeded[langKey]}</p>
                  </div>
                  <div className="p-3 rounded-md border border-[var(--border)] bg-[var(--bg-alt)]">
                    <div className="font-semibold text-[var(--text)] mb-0.5">{isRu ? 'Как это работает на практике:' : 'How It Works in Practice:'}</div>
                    <p className="text-[var(--text-sec)] m-0">{feat.howItWorks[langKey]}</p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-md border border-[var(--border)] bg-[var(--accent-bg)] text-xs text-[var(--text)] flex items-start gap-2">
                <Sparkles size={14} color="var(--accent)" className="shrink-0 mt-0.5" />
                <span>{feat.realExample[langKey]}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeSection === 'questions' && (
        <div className="space-y-4" data-testid="faq-questions-list">
          <div className="card px-4 py-3 flex items-center gap-2 flex-wrap">
            {AUDIENCE_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setAudienceFilter(f.id)}
                className={audienceFilter === f.id ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
              >
                <span>{f.label[langKey]}</span>
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredQuestions.map((qItem) => {
              const isExpanded = expandedFaqId === qItem.id;
              return (
                <div key={qItem.id} className="card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedFaqId(isExpanded ? null : qItem.id)}
                    className="w-full text-left p-5 flex items-start justify-between gap-4 bg-transparent border-0 cursor-pointer hover:bg-[var(--surface-hover)] transition"
                  >
                    <div className="space-y-1">
                      <span className="badge badge-accent">{qItem.roleBadge[langKey]}</span>
                      <h3 className="text-[0.9375rem] font-semibold text-[var(--text)] m-0">{qItem.question[langKey]}</h3>
                      <p className="text-xs text-[var(--text-sec)] m-0 leading-relaxed">{qItem.shortAnswer[langKey]}</p>
                    </div>
                    <span className="mono text-xs font-semibold text-[var(--accent)] shrink-0 mt-1">
                      {isExpanded ? (isRu ? 'Свернуть ▲' : 'Hide ▲') : (isRu ? 'Подробнее ▼' : 'Details ▼')}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-5 pt-3 border-t border-[var(--border)] bg-[var(--bg-alt)] space-y-3">
                      <div className="text-xs font-semibold text-[var(--text)]">{isRu ? 'Подробный разбор по шагам:' : 'Step-by-Step Breakdown:'}</div>
                      <ul className="space-y-2 m-0 pl-0 list-none">
                        {qItem.detailedSteps[langKey].map((step, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-xs text-[var(--text-sec)] leading-relaxed">
                            <CheckCircle2 size={14} color="var(--success)" className="shrink-0 mt-0.5" />
                            <span>{step}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[var(--border)]">
                        <div className="text-xs text-[var(--text)]">
                          <strong className="text-[var(--success)]">{isRu ? 'Результат для бизнеса: ' : 'Business Impact: '}</strong>
                          {qItem.businessImpact[langKey]}
                        </div>
                        {qItem.relatedView && onNavigate && (
                          <button type="button" onClick={() => onNavigate(qItem.relatedView!)} className="btn btn-primary btn-sm">
                            <span>{isRu ? 'Перейти к этой функции' : 'Open This Feature'}</span>
                            <ArrowRight size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
export default FaqGuideView;
