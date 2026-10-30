import React from 'react';
import { Upload, RotateCcw, Sparkles, CheckCircle2, Search } from 'lucide-react';
import { DemoState } from '../hooks/useDemoState';

export interface DemoBannerProps {
  state: DemoState;
  ownItemsCount: number;
  demoItemsCount?: number;
  onOpenUpload: () => void;
  onReset: () => void;
}

export const DemoBanner: React.FC<DemoBannerProps> = ({
  state,
  ownItemsCount,
  demoItemsCount = 48,
  onOpenUpload,
  onReset,
}) => {
  if (state === 'welcome') {
    return null;
  }

  const isDemo = state === 'demo';

  const handleFocusOwnSearch = () => {
    const input = document.querySelector<HTMLInputElement>('[data-testid="search-input"]');
    if (input) {
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      input.focus();
    }
  };

  return (
    <div className="max-w-[1280px] mx-auto px-6 pt-4">
      <div
        data-testid="demo-state-banner"
        className={`card px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs border-2 ${
          isDemo
            ? 'border-[var(--warning)]/60 bg-[var(--warning-bg)]'
            : 'border-[var(--success)]/60 bg-[var(--success-bg)]'
        }`}
      >
        <div className="flex items-center gap-2.5 flex-wrap">
          {isDemo ? (
            <Sparkles size={16} className="text-[var(--warning)] shrink-0" />
          ) : (
            <CheckCircle2 size={16} className="text-[var(--success)] shrink-0" />
          )}
          <div>
            <span className="font-bold text-[var(--text)]" data-testid="indexed-items-count">
              {isDemo
                ? `Вы сейчас в демо-режиме (${demoItemsCount} SKU проиндексировано). Данные изолированы.`
                : `${ownItemsCount} товаров проиндексировано · Режим «Мой каталог»`}
            </span>
            <span
              data-testid="demo-index-ready-badge"
              className="ml-2 px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] mono text-[11px] font-semibold text-[var(--success)]"
            >
              ✓ Индекс готов
            </span>
            <span className="hidden lg:inline text-[var(--text-sec)] ml-2">
              {isDemo
                ? 'Эксперименты с гибридным поиском, весом α и X-Ray выполняются в изолированной песочнице.'
                : 'Поиск и рекомендации работают исключительно по вашему загруженному каталогу.'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!isDemo && (
            <button
              type="button"
              onClick={handleFocusOwnSearch}
              data-testid="search-own-catalog-btn"
              className="btn btn-primary btn-sm"
            >
              <Search size={13} />
              <span>Найти по вашему каталогу</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenUpload}
            data-testid="banner-upload-btn"
            className={isDemo ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
          >
            <Upload size={13} />
            <span>{isDemo ? 'Загрузить свой каталог' : 'Загрузить другой CSV/JSON'}</span>
          </button>
          <button
            type="button"
            onClick={onReset}
            data-testid="banner-reset-btn"
            className="btn btn-secondary btn-sm"
          >
            <RotateCcw size={13} />
            <span>{isDemo ? 'Выйти из демо и очистить' : 'Очистить базу (0 SKU)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
