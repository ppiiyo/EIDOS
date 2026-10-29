import React from 'react';
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
    <div
      data-testid="demo-state-banner"
      className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
        isDemo
          ? 'bg-[#1e293b] border-amber-500/40 text-[#f1f5f9]'
          : 'bg-[#1e293b] border-emerald-500/40 text-[#f1f5f9]'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${
            isDemo ? 'bg-amber-400' : 'bg-emerald-400'
          }`}
          aria-hidden="true"
        />
        <span className="font-medium text-[#f1f5f9]">
          {isDemo
            ? `Вы смотрите изолированный демо-каталог (${demoItemsCount} товаров: Маркетплейс, Стриминг, Видеохостинг JP, Мультиязычный корпус).`
            : `Вы используете свой собственный каталог (${ownItemsCount} товаров). Все вкладки движка работают с вашей базой.`}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenUpload}
          data-testid="banner-upload-btn"
          className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition-colors cursor-pointer"
        >
          {isDemo ? 'Загрузить свой каталог' : 'Загрузить другой CSV/JSON'}
        </button>
        <button
          type="button"
          onClick={onReset}
          data-testid="banner-reset-btn"
          className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-slate-800 text-slate-200 border border-slate-600 hover:bg-slate-700 transition-colors cursor-pointer"
        >
          {isDemo ? 'Выйти из демо' : 'Очистить базу'}
        </button>
      </div>
    </div>
  );
};
