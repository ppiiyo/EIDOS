import React from 'react';

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
    <div
      data-testid="demo-welcome-screen"
      className="min-h-[calc(100vh-88px)] w-full rounded-xl bg-[#0f172a] text-[#f1f5f9] p-6 md:p-10 flex flex-col justify-center items-center border border-slate-800"
    >
      <div className="max-w-3xl w-full space-y-8">
        <div className="text-center space-y-3">
          <div className="text-xs font-mono uppercase tracking-widest text-indigo-400">
            EIDOS · Hybrid Semantic Search & Discovery Engine
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[#f1f5f9]">
            Выберите источник данных для поиска
          </h1>
          <p className="text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Основной продукт запускается с чистым индексом (0 товаров). Загрузите собственный
            каталог (CSV/JSON) или протестируйте движок в изолированном демо-режиме (18 SKU).
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <button
            type="button"
            onClick={handleUpload}
            data-testid="welcome-upload-btn"
            className="w-full sm:w-auto px-6 py-3 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-950/50 transition-colors cursor-pointer"
          >
            Загрузить свой каталог
          </button>
          <button
            type="button"
            onClick={handleTryDemo}
            data-testid="welcome-demo-btn"
            className="w-full sm:w-auto px-6 py-3 rounded-lg text-sm font-semibold bg-[#1e293b] text-[#f1f5f9] border border-slate-700 hover:bg-slate-800 hover:border-slate-600 transition-colors cursor-pointer"
          >
            Попробовать на демо-данных
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          <div className="rounded-xl bg-[#1e293b] border border-slate-800 p-5 space-y-2">
            <div className="text-sm font-semibold text-[#f1f5f9]">
              Поиск по намерению (Intent-Aware)
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Автоматическое извлечение категории, сценария использования и ценового диапазона из
              естественных запросов на русском и английском языках.
            </p>
          </div>

          <div className="rounded-xl bg-[#1e293b] border border-slate-800 p-5 space-y-2">
            <div className="text-sm font-semibold text-[#f1f5f9]">
              X-Ray Query Inspector
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Прозрачная декомпозиция итогового скора каждого товара на лексический (BM25) и
              семантический (384-d) вклад с интерактивным слайдером α.
            </p>
          </div>

          <div className="rounded-xl bg-[#1e293b] border border-slate-800 p-5 space-y-2">
            <div className="text-sm font-semibold text-[#f1f5f9]">
              Быстрый импорт CSV / JSON
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Загрузка каталога батчами через <code className="text-indigo-300">POST /v1/catalog/upsert</code>{' '}
              с мгновенным построением HNSW-индекса без перезапуска сервера.
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-[#1e293b] border border-slate-800 p-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-300">
          <div>
            <span className="font-semibold text-[#f1f5f9]">Демо-база изолирована:</span>{' '}
            основной продукт не содержит демо-товаров по умолчанию.
          </div>
          <div className="font-mono text-slate-400">
            Форматы: .csv, .json · Изолированное демо: 18 SKU
          </div>
        </div>
      </div>
    </div>
  );
};
