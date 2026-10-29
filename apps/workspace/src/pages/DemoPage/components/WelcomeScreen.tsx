import React from 'react';
import { Upload, Sparkles, Search, Microscope, Database, ShieldCheck } from 'lucide-react';

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
      <div className="card p-8 md:p-10">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 badge badge-accent mono mb-3">
            <Sparkles size={13} />
            <span>EIDOS v3.2 · Hybrid Semantic Search & Cognitive Discovery Engine</span>
          </div>

          <h1 className="page-title text-2xl md:text-3xl mb-3">
            Основной рабочий контур (0 товаров в индексе)
          </h1>

          <p className="text-sm md:text-base text-[var(--text-sec)] max-w-2xl mx-auto leading-relaxed mb-6">
            На обычных вкладках платформы («Поиск», «Каталог», «Дашборд», «Рекомендации», «3D Векторы»)
            демо-товары не предзагружаются. Загрузите собственную базу данных (<strong>CSV</strong> или{' '}
            <strong>JSON</strong>), чтобы анализировать работу движка на своих товарах, или откройте
            изолированную вкладку <strong>«Демо-каталог (48 SKU)»</strong>.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
            <button
              type="button"
              onClick={handleUpload}
              data-testid="welcome-upload-btn"
              className="btn btn-primary px-6 py-3 text-sm w-full sm:w-auto"
            >
              <Upload size={16} />
              <span>Загрузить свой каталог (CSV / JSON)</span>
            </button>

            <button
              type="button"
              onClick={handleTryDemo}
              data-testid="welcome-demo-btn"
              className="btn btn-secondary px-6 py-3 text-sm w-full sm:w-auto"
            >
              <Sparkles size={16} className="text-[var(--accent)]" />
              <span>Открыть Демо-каталог (48 SKU + метрики)</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-[var(--border)]">
          <div className="card p-4 bg-[var(--bg-alt)]">
            <div className="flex items-center gap-2 font-semibold text-sm text-[var(--text)] mb-1.5">
              <Search size={15} className="text-[var(--accent)]" />
              <span>Поиск по намерению (Intent-Aware)</span>
            </div>
            <p className="text-xs text-[var(--text-sec)] leading-relaxed">
              Автоматическое извлечение категории, сценария использования и ценового бюджета из
              запросов на русском, английском и японском языках с динамическим бустингом выдачи.
            </p>
          </div>

          <div className="card p-4 bg-[var(--bg-alt)]">
            <div className="flex items-center gap-2 font-semibold text-sm text-[var(--text)] mb-1.5">
              <Microscope size={15} className="text-[var(--success)]" />
              <span>X-Ray Inspector & 3 Когнитивных вектора</span>
            </div>
            <p className="text-xs text-[var(--text-sec)] leading-relaxed">
              Декомпозиция скоринга (384-d Dense, BM25, RRF, MMR) + Кинетический вектор курсора,
              Анти-Эхо-Камера (проекция Грама–Шмидта) и Хроно-когнитивный вектор темпа сессии.
            </p>
          </div>

          <div className="card p-4 bg-[var(--bg-alt)]">
            <div className="flex items-center gap-2 font-semibold text-sm text-[var(--text)] mb-1.5">
              <Database size={15} className="text-[var(--accent)]" />
              <span>Мгновенная векторизация CSV / JSON</span>
            </div>
            <p className="text-xs text-[var(--text-sec)] leading-relaxed">
              Импорт вашего каталога батчами через <code className="mono text-[var(--accent)]">POST /v1/catalog/upsert</code>{' '}
              с автоматическим построением 384-d L2 HNSW-индекса для всех разделов студии.
            </p>
          </div>
        </div>

        <div className="mt-5 px-4 py-3 rounded-lg bg-[var(--bg-alt)] border border-[var(--border)] flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-sec)]">
          <div className="flex items-center gap-2">
            <ShieldCheck size={15} className="text-[var(--success)]" />
            <span>
              <strong className="text-[var(--text)]">Строгая изоляция данных:</strong> основной
              продукт работает исключительно с вашей загруженной базой.
            </span>
          </div>
          <span className="mono">
            Форматы: .csv, .json · Демо-стенд: 48 SKU (RU / EN / JA / ZH / ES / DE)
          </span>
        </div>
      </div>
    </div>
  );
};
