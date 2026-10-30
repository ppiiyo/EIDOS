import React from 'react';
import { Upload, Sparkles, Search, Eye, Sliders, ShieldCheck } from 'lucide-react';

export interface WelcomeScreenProps {
  onTryDemo?: () => void;
  onUpload?: () => void;
  onSelectDemo?: () => void;
  onOpenUpload?: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onTryDemo,
  onUpload,
  onSelectDemo,
  onOpenUpload,
}) => {
  const handleUpload = onUpload || onOpenUpload || (() => {});
  const handleTryDemo = onTryDemo || onSelectDemo || (() => {});

  return (
    <div className="page" data-testid="demo-welcome-screen">
      <div className="card p-8 md:p-12 border border-[var(--border)] bg-[var(--surface)]">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 badge badge-accent mono mb-4">
            <Sparkles size={13} />
            <span>EIDOS v3.4.0 · Hybrid Search & Explainable Ranking Studio</span>
          </div>

          <h1 className="page-title text-2xl md:text-4xl font-extrabold tracking-tight mb-3">
            Гибридный поиск с объяснимым ранжированием
          </h1>

          <p className="text-base md:text-lg text-[var(--text-sec)] max-w-xl mx-auto leading-relaxed mb-7">
            Пойми, почему именно эти товары в топе — за <strong className="mono text-[var(--success)]">0.5 мс</strong>.
            Управляй балансом смысла, ключевых слов и бизнес-правил в реальном времени.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-8">
            <button
              type="button"
              onClick={handleTryDemo}
              data-testid="welcome-demo-btn"
              className="btn btn-primary px-7 py-3.5 text-sm font-bold w-full sm:w-auto shadow-sm"
            >
              <Sparkles size={16} />
              <span>Попробовать на демо-каталоге (48 товаров)</span>
            </button>

            <button
              type="button"
              onClick={handleUpload}
              data-testid="welcome-upload-btn"
              className="btn btn-secondary px-6 py-3.5 text-sm w-full sm:w-auto"
            >
              <Upload size={16} />
              <span>Загрузить свой CSV / JSON</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-[var(--border)]">
          <div className="card p-4 bg-[var(--bg-alt)]">
            <div className="flex items-center gap-2 font-semibold text-sm text-[var(--text)] mb-1">
              <Search size={15} className="text-[var(--accent)]" />
              <span>1. Умный разбор намерения</span>
            </div>
            <p className="text-xs text-[var(--text-sec)] leading-relaxed">
              Запрос «недорогие наушники для бега» автоматически выделяет категорию, сценарий и бюджет.
            </p>
          </div>

          <div className="card p-4 bg-[var(--bg-alt)]">
            <div className="flex items-center gap-2 font-semibold text-sm text-[var(--text)] mb-1">
              <Eye size={15} className="text-[var(--success)]" />
              <span>2. Прозрачный X-Ray (7 факторов)</span>
            </div>
            <p className="text-xs text-[var(--text-sec)] leading-relaxed">
              Точная формула каждого места в выдаче: Семантика, BM25, RRF, MMR, Бизнес-буст и 3 когнитивных вектора.
            </p>
          </div>

          <div className="card p-4 bg-[var(--bg-alt)]">
            <div className="flex items-center gap-2 font-semibold text-sm text-[var(--text)] mb-1">
              <Sliders size={15} className="text-[var(--accent)]" />
              <span>3. Мгновенный контроль (60 FPS)</span>
            </div>
            <p className="text-xs text-[var(--text-sec)] leading-relaxed">
              Переключай вес Semantic ↔ Lexical, отключай MMR или Intent в 1 клик и экспортируй конфиг в код.
            </p>
          </div>
        </div>

        <div className="mt-5 px-4 py-2.5 rounded-lg bg-[var(--bg-alt)] border border-[var(--border)] flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-sec)]">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-[var(--success)]" />
            <span>
              <strong className="text-[var(--text)]">Мой каталог (0 SKU):</strong> чистый рабочий контур без предзагруженных демо-данных.
            </span>
          </div>
          <span className="mono">EIDOS v3.4.0 · .csv / .json / REST API</span>
        </div>
      </div>
    </div>
  );
};
