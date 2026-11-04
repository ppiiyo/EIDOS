import React, { useState } from 'react';
import {
  AdminAnalyticsSummary,
  TenantDictionariesDto,
  TenantRankingDefaultsDto,
} from '../types';

export const AdminAnalyticsTab: React.FC<{
  lang: 'ru' | 'en';
  summary: AdminAnalyticsSummary | null;
  period: '24h' | '7d' | '30d';
  onChangePeriod: (p: '24h' | '7d' | '30d') => void;
  onAddSynonymForQuery: (q: string) => void;
}> = ({ lang, summary, period, onChangePeriod, onAddSynonymForQuery }) => {
  const handleExportCsv = () => {
    if (!summary) return;
    const rows = [
      'query,count,emptyCount,avgLatencyMs,top1Category',
      ...summary.topQueries.map(
        (q) =>
          `"${q.query.replace(/"/g, '""')}",${q.count},${q.emptyCount},${q.avgLatencyMs},"${(q.top1Category || '').replace(/"/g, '""')}"`
      ),
    ].join('\n');
    const blob = new Blob([rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eidos-analytics-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4" data-testid="admin-analytics">
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
          {(['24h', '7d', '30d'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChangePeriod(p)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                period === p ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded hover:bg-slate-800"
        >
          {lang === 'ru' ? 'Скачать CSV' : 'Export CSV'}
        </button>
      </div>

      {summary && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-mono tabular-nums">
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs font-sans text-slate-500">
                {lang === 'ru' ? 'Всего поисковых запросов' : 'Total Searches'}
              </div>
              <div className="text-xl font-semibold text-slate-900 mt-1">{summary.totalSearches}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs font-sans text-slate-500">
                {lang === 'ru' ? 'Доля пустых выдач' : 'Zero-Result Share'}
              </div>
              <div className="text-xl font-semibold text-slate-900 mt-1">
                {summary.zeroResultRate}% ({summary.emptySearches})
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs font-sans text-slate-500">p50 / p95 Latency</div>
              <div className="text-xl font-semibold text-slate-900 mt-1">
                {summary.p50LatencyMs} / {summary.p95LatencyMs} ms
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs font-sans text-slate-500">
                {lang === 'ru' ? 'Честная воронка (Поиски → Клики)' : 'Honest Funnel (Search → Click)'}
              </div>
              <div className="text-xl font-semibold text-slate-900 mt-1">
                {summary.honestFunnel.searches} → {summary.honestFunnel.clicks} ({summary.honestFunnel.ctrPercent}%)
              </div>
              <div className="text-[11px] font-sans text-slate-400 mt-0.5">
                {summary.honestFunnel.hasStorefrontOrderEvents
                  ? `Purchases: ${summary.honestFunnel.purchases}`
                  : lang === 'ru'
                  ? 'Без фейковых заказов (ждёт POST /v1/events с витрины)'
                  : 'Honest telemetry: order attribution shown only when POST /v1/events sent'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-slate-700 mb-3">
                {lang === 'ru' ? 'Топ запросов за период' : 'Top Queries'}
              </h4>
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-1.5 font-medium">{lang === 'ru' ? 'Запрос' : 'Query'}</th>
                    <th className="py-1.5 font-medium text-right">{lang === 'ru' ? 'Запросов' : 'Count'}</th>
                    <th className="py-1.5 font-medium text-right">Avg ms</th>
                    <th className="py-1.5 font-medium text-right">{lang === 'ru' ? 'Категория #1' : 'Top-1 Cat'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                  {summary.topQueries.map((q) => (
                    <tr key={q.query}>
                      <td className="py-1.5 font-sans text-slate-900">{q.query}</td>
                      <td className="py-1.5 text-right">{q.count}</td>
                      <td className="py-1.5 text-right text-slate-500">{q.avgLatencyMs}</td>
                      <td className="py-1.5 text-right font-sans text-slate-600">{q.top1Category || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-slate-700 mb-3">
                {lang === 'ru' ? 'Топ запросов с пустой выдачей (count = 0)' : 'Top Zero-Result Queries'}
              </h4>
              {summary.topZeroResultQueries.length === 0 ? (
                <div className="text-xs text-slate-400 py-6 text-center">
                  {lang === 'ru' ? 'Пустых выдач за выбранный период нет' : 'No zero-result queries recorded'}
                </div>
              ) : (
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-1.5 font-medium">{lang === 'ru' ? 'Запрос' : 'Query'}</th>
                      <th className="py-1.5 font-medium text-right">{lang === 'ru' ? 'Пустых' : 'Count'}</th>
                      <th className="py-1.5 font-medium text-right">{lang === 'ru' ? 'Действие' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                    {summary.topZeroResultQueries.map((zq) => (
                      <tr key={zq.query}>
                        <td className="py-1.5 font-sans text-slate-900">{zq.query}</td>
                        <td className="py-1.5 text-right text-rose-600 font-semibold">{zq.count}</td>
                        <td className="py-1.5 text-right font-sans">
                          <button
                            type="button"
                            onClick={() => onAddSynonymForQuery(zq.query)}
                            className="text-slate-700 hover:text-slate-950 underline"
                          >
                            {lang === 'ru' ? '+ Синоним' : '+ Synonym'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export const AdminDictionariesTab: React.FC<{
  lang: 'ru' | 'en';
  dictionaries: TenantDictionariesDto;
  prefillPhrase?: string;
  onSaveDictionaries: (patch: {
    synonyms: Array<{ id?: string; phrase: string; replacement: string; enabled?: boolean }>;
    rewrites: Array<{ id?: string; from: string; to: string; enabled?: boolean }>;
    stopwords: string[];
  }) => Promise<void>;
  onTestInLiveSearch: (query: string) => void;
}> = ({ lang, dictionaries, prefillPhrase = '', onSaveDictionaries, onTestInLiveSearch }) => {
  const [phrase, setPhrase] = useState(prefillPhrase);
  const [replacement, setReplacement] = useState('');
  const [rwFrom, setRwFrom] = useState('');
  const [rwTo, setRwTo] = useState('');
  const [stopwordInput, setStopwordInput] = useState(dictionaries.stopwords.join(', '));
  const [jsonImportText, setJsonImportText] = useState('');

  const handleAddSynonym = async () => {
    if (!phrase.trim() || !replacement.trim()) return;
    await onSaveDictionaries({
      synonyms: [
        ...dictionaries.synonyms,
        { phrase: phrase.trim(), replacement: replacement.trim(), enabled: true },
      ],
      rewrites: dictionaries.rewrites,
      stopwords: dictionaries.stopwords,
    });
    setPhrase('');
    setReplacement('');
  };

  const handleAddRewrite = async () => {
    if (!rwFrom.trim() || !rwTo.trim()) return;
    await onSaveDictionaries({
      synonyms: dictionaries.synonyms,
      rewrites: [...dictionaries.rewrites, { from: rwFrom.trim(), to: rwTo.trim(), enabled: true }],
      stopwords: dictionaries.stopwords,
    });
    setRwFrom('');
    setRwTo('');
  };

  const handleSaveStopwords = async () => {
    const words = stopwordInput
      .split(',')
      .map((w) => w.trim())
      .filter(Boolean);
    await onSaveDictionaries({
      synonyms: dictionaries.synonyms,
      rewrites: dictionaries.rewrites,
      stopwords: words,
    });
  };

  const handleImportJson = async () => {
    try {
      const parsed = JSON.parse(jsonImportText);
      await onSaveDictionaries({
        synonyms: Array.isArray(parsed.synonyms) ? parsed.synonyms : dictionaries.synonyms,
        rewrites: Array.isArray(parsed.rewrites) ? parsed.rewrites : dictionaries.rewrites,
        stopwords: Array.isArray(parsed.stopwords) ? parsed.stopwords : dictionaries.stopwords,
      });
      setJsonImportText('');
    } catch {
      // Ignore malformed JSON
    }
  };

  return (
    <div className="space-y-4" data-testid="admin-dictionaries">
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-900">
            {lang === 'ru' ? 'Синонимы и переписывание запросов (Query Preprocessing)' : 'Synonyms & Query Rewrites'}
          </h4>
          <span className="text-xs font-mono text-slate-500">v{dictionaries.version}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
          <div className="md:col-span-5">
            <label className="block text-xs text-slate-600 mb-1">
              {lang === 'ru' ? 'Исходная фраза покупателя' : 'Shopper Phrase'}
            </label>
            <input
              type="text"
              data-testid="dict-synonym-phrase"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder={lang === 'ru' ? 'Например: уши для марафона' : 'e.g., marathon buds'}
              className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded text-slate-900"
            />
          </div>
          <div className="md:col-span-5">
            <label className="block text-xs text-slate-600 mb-1">
              {lang === 'ru' ? 'Нормализованный запрос (Каноническая форма)' : 'Canonical Replacement'}
            </label>
            <input
              type="text"
              data-testid="dict-synonym-replacement"
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              placeholder={lang === 'ru' ? 'Например: спортивные наушники для бега' : 'e.g., running headphones'}
              className="w-full px-3 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded text-slate-900"
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="button"
              data-testid="dict-add-synonym-btn"
              onClick={handleAddSynonym}
              className="w-full py-1.5 px-3 text-xs font-medium bg-slate-900 text-white rounded hover:bg-slate-800"
            >
              {lang === 'ru' ? 'Добавить' : 'Add Rule'}
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {dictionaries.synonyms.map((s) => (
            <div key={s.id} className="py-2 flex items-center justify-between">
              <div>
                <span className="font-medium text-slate-900">{s.phrase}</span>
                <span className="mx-2 text-slate-400">→</span>
                <span className="text-emerald-700 font-medium">{s.replacement}</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onTestInLiveSearch(s.phrase)}
                  className="text-slate-700 hover:text-slate-950 underline"
                >
                  {lang === 'ru' ? 'Проверить До/После' : 'Test in Live Search'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onSaveDictionaries({
                      synonyms: dictionaries.synonyms.filter((x) => x.id !== s.id),
                      rewrites: dictionaries.rewrites,
                      stopwords: dictionaries.stopwords,
                    })
                  }
                  className="text-rose-600 hover:text-rose-800"
                >
                  {lang === 'ru' ? 'Удалить' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
          <div className="text-xs font-semibold text-slate-800">
            {lang === 'ru' ? 'Стоп-слова (Stopwords через запятую)' : 'Stopwords (comma-separated)'}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={stopwordInput}
              onChange={(e) => setStopwordInput(e.target.value)}
              placeholder="купить, недорого, срочно, пожалуйста"
              className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded text-slate-900"
            />
            <button
              type="button"
              onClick={handleSaveStopwords}
              className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded"
            >
              {lang === 'ru' ? 'Сохранить' : 'Save'}
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
          <div className="text-xs font-semibold text-slate-800">
            {lang === 'ru' ? 'Импорт словаря (JSON)' : 'Import Dictionary JSON'}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={jsonImportText}
              onChange={(e) => setJsonImportText(e.target.value)}
              placeholder='{"synonyms":[{"phrase":"абибас","replacement":"кроссовки adidas"}]}'
              className="flex-1 px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded text-slate-900"
            />
            <button
              type="button"
              onClick={handleImportJson}
              className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-900 rounded"
            >
              Import JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AdminRankingTab: React.FC<{
  lang: 'ru' | 'en';
  defaults: TenantRankingDefaultsDto;
  onSaveDefaults: (patch: Partial<TenantRankingDefaultsDto>) => Promise<void>;
}> = ({ lang, defaults, onSaveDefaults }) => {
  const [gate, setGate] = useState<'hard' | 'soft' | 'off'>(defaults.simpleCategoryGate);
  const [alpha, setAlpha] = useState<number>(defaults.defaultAlpha);
  const [minScore, setMinScore] = useState<number>(defaults.minScore);

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 max-w-2xl space-y-4" data-testid="admin-ranking-settings">
      <h3 className="text-sm font-semibold text-slate-900">
        {lang === 'ru'
          ? 'Политика ранжирования по умолчанию (применяется к витринному /v1/search)'
          : 'Storefront Ranking Defaults (applied automatically to /v1/search)'}
      </h3>
      <div className="space-y-3 text-xs">
        <div>
          <label className="block font-medium text-slate-700 mb-1">
            simpleCategoryGate ({lang === 'ru' ? 'Фильтрация нецелевых категорий' : 'Category Intent Gate'})
          </label>
          <select
            value={gate}
            onChange={(e) => setGate(e.target.value as 'hard' | 'soft' | 'off')}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded text-slate-900"
          >
            <option value="hard">hard — Строго отсекать чужие категории (рекомендуется для витрины)</option>
            <option value="soft">soft — Понижать чужие категории в ранге</option>
            <option value="off">off — Выключено</option>
          </select>
        </div>

        <div>
          <label className="block font-medium text-slate-700 mb-1">
            defaultAlpha: {alpha.toFixed(2)} ({Math.round(alpha * 100)}% Semantic / {Math.round((1 - alpha) * 100)}% BM25+)
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={alpha}
            onChange={(e) => setAlpha(parseFloat(e.target.value))}
            className="w-full accent-slate-900"
          />
        </div>

        <div>
          <label className="block font-medium text-slate-700 mb-1">
            minScore (Confidence Floor): {minScore.toFixed(2)}
          </label>
          <input
            type="number"
            min={0}
            max={0.9}
            step={0.01}
            value={minScore}
            onChange={(e) => setMinScore(parseFloat(e.target.value) || 0)}
            className="w-40 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-slate-900 font-mono"
          />
        </div>

        <button
          type="button"
          data-testid="admin-save-ranking-btn"
          onClick={() => onSaveDefaults({ simpleCategoryGate: gate, defaultAlpha: alpha, minScore })}
          className="px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded hover:bg-slate-800"
        >
          {lang === 'ru' ? 'Сохранить настройки ранжирования' : 'Save Ranking Defaults'}
        </button>
      </div>
    </div>
  );
};
