import React from 'react';
import { Upload, RotateCcw, Sparkles, CheckCircle2 } from 'lucide-react';
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

  return (
    <div className="max-w-[1280px] mx-auto px-6 pt-5">
      <div
        data-testid="demo-state-banner"
        className={`card px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs ${
          isDemo
            ? 'border-[var(--warning)]/50 bg-[var(--warning-bg)]'
            : 'border-[var(--success)]/50 bg-[var(--success-bg)]'
        }`}
      >
        <div className="flex items-center gap-2.5">
          {isDemo ? (
            <Sparkles size={15} className="text-[var(--warning)] shrink-0" />
          ) : (
            <CheckCircle2 size={15} className="text-[var(--success)] shrink-0" />
          )}
          <span className="font-medium text-[var(--text)]">
            {isDemo
              ? `Режим «Демо-каталог»: загружен полный демонстрационный корпус (${demoItemsCount} SKU · 4 домена: Маркетплейс, Стриминг, Видео JP, Мультиязычный).`
              : `Активен ваш пользовательский каталог (${ownItemsCount} SKU). Все разделы движка работают с вашей базой.`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenUpload}
            data-testid="banner-upload-btn"
            className="btn btn-primary btn-sm"
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
            <span>{isDemo ? 'Выйти к своей базе' : 'Очистить базу (0 SKU)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
