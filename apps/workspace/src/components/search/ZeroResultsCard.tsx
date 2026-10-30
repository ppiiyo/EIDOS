import React from 'react';
import { SearchX, RotateCcw, Sparkles } from 'lucide-react';
import { UiLanguage } from '../../i18n/uiTranslations';

export interface ZeroResultsCardProps {
  query: string;
  alpha: number;
  uiLang?: UiLanguage;
  suggestedQueries?: string[];
  onRetryQuery: (nextQuery: string, nextAlpha?: number) => void;
  onResetFilters: () => void;
}

export const ZeroResultsCard: React.FC<ZeroResultsCardProps> = ({
  query,
  alpha,
  uiLang = 'ru',
  suggestedQueries = [],
  onRetryQuery,
  onResetFilters,
}) => {
  const isRu = uiLang === 'ru';
  const hints =
    suggestedQueries.length > 0
      ? suggestedQueries.slice(0, 2)
      : isRu
        ? ['недорогие наушники для бега', 'космос и время']
        : ['wireless running headphones', 'space and time dilation'];

  return (
    <div
      data-testid="zero-results-card"
      className="card p-7 border border-[var(--border)] bg-[var(--surface)]"
    >
      <div className="flex items-start gap-3.5">
        <div className="p-2.5 rounded-lg bg-[var(--warning)]/15 text-[var(--warning)] shrink-0">
          <SearchX size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-[var(--text)]">
            {isRu ? 'Ничего не найдено' : 'No matching items found'}
          </h3>
          <p className="text-xs text-[var(--text-sec)] mt-1 leading-relaxed">
            {isRu
              ? `По запросу «${query || '—'}» не найдено релевантных позиций в активном индексе.`
              : `No relevant items matched "${query || '—'}" in the active index.`}
          </p>

          <div className="mt-3 text-xs text-[var(--text-sec)] space-y-1">
            <div className="font-semibold text-[var(--text)]">
              {isRu ? 'Возможные причины:' : 'Possible reasons:'}
            </div>
            <ul className="list-disc list-inside space-y-0.5">
              {alpha <= 0.05 && (
                <li>
                  {isRu
                    ? 'Включён режим только точных слов (Pure BM25, α = 0.00) — семантический поиск 384-d отключён.'
                    : 'Pure lexical mode (BM25 only, α = 0.00) is active — 384-d semantic matching is disabled.'}
                </li>
              )}
              <li>
                {isRu
                  ? 'Опечатка в артикуле или слишком узкая формулировка запроса.'
                  : 'Typo in SKU code or overly narrow query phrasing.'}
              </li>
              <li>
                {isRu
                  ? 'Товар из этой категории ещё не загружен в текущий каталог.'
                  : 'Items from this category are not present in the current catalog.'}
              </li>
            </ul>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[var(--text-sec)] flex items-center gap-1">
              <Sparkles size={12} className="text-[var(--accent)]" />
              <span>{isRu ? 'Попробуйте переформулировать:' : 'Try a suggested query:'}</span>
            </span>
            {hints.map((hint) => (
              <button
                key={hint}
                type="button"
                data-testid="zero-results-hint"
                onClick={() => onRetryQuery(hint, 0.7)}
                className="btn btn-secondary btn-sm"
              >
                {hint}
              </button>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--border)] flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="zero-results-reset-btn"
              onClick={onResetFilters}
              className="btn btn-primary btn-sm"
            >
              <RotateCcw size={13} />
              <span>
                {isRu
                  ? 'Сбросить фильтры и включить гибридный режим (α = 0.70)'
                  : 'Reset filters & enable hybrid mode (α = 0.70)'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
