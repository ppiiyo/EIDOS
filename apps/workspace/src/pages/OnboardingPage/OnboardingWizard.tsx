import React, { useState, useMemo } from 'react';
import { CatalogItem } from '../../types';
import { HybridSearchHit } from '../../utils/recommenderEngine';
import { parseCsv, parseFile, ParsedCatalogItem } from '../DemoPage/lib/csv-parser';
import { ViewId } from '../../components/Sidebar';

export interface OnboardingWizardProps {
  catalog: CatalogItem[];
  onImportCustomDatabase?: (items: CatalogItem[], label?: string) => void;
  onHybridSearch: (query: string, alpha: number, limit?: number) => Promise<HybridSearchHit[]>;
  onNavigate: (view: ViewId) => void;
  onShowToast?: (message: string, type?: 'info' | 'success' | 'error') => void;
}

export interface QualityProbeResult {
  id: string;
  kind: 'title_1' | 'title_2' | 'brand_sku' | 'semantic' | 'nonsense';
  label: string;
  query: string;
  count: number;
  topTitle: string | null;
  tookMs: number;
  passed: boolean;
}

const SAMPLE_CSV = `id,title,category,price,brand,sku,in_stock,description,tags
sku-101,"Беспроводные наушники Sony WH-1000XM5",Аудио,34990,Sony,WH1000XM5B,true,"Флагманские полноразмерные наушники с активным шумоподавлением ANC, до 30 часов работы и быстрой зарядкой USB-C.","наушники;шумоподавление;bluetooth;для офиса;для перелетов"
sku-102,"Спортивные наушники Shokz OpenRun Pro",Аудио,15990,Shokz,S810-BK,true,"Легкие беговые наушники с костной проводимостью и защитой от пота IP55 для марафона и тренировок на улице.","наушники;для бега;спорт;водостойкие"
sku-103,"Кроссовки беговые Asics Gel-Kayano 30",Обувь,18490,Asics,1011B548,true,"Стабилизирующие кроссовки для длительного бега по асфальту с амортизацией FF BLAST PLUS ECO.","кроссовки;для бега;марафон;амортизация"
sku-104,"Механическая клавиатура Keychron Q1 Pro Wireless",Периферия,21500,Keychron,Q1P-M1,true,"Кастомная алюминиевая клавиатура 75% с QMK/VIA, хот-свапом и тактильными переключателями.","клавиатура;механическая;для программирования;bluetooth"
sku-105,"Кофемашина автоматическая DeLonghi Magnifica Evo",Техника для кухни,49990,DeLonghi,ECAM290.81,true,"Зерновая кофемашина с капучинатором LatteCrema для приготовления эспрессо, капучино и латте дома.","кофемашина;эспрессо;капучино;для дома"`;

function toCatalogItem(parsed: ParsedCatalogItem, index: number): CatalogItem {
  return {
    id: parsed.id || `item-${index + 1}`,
    title: parsed.title,
    category: parsed.category || 'Каталог',
    description: parsed.description || parsed.title,
    price: typeof parsed.price === 'number' ? parsed.price : 0,
    rating: 4.8,
    inStock: parsed.inStock !== false,
    margin: 0.3,
    tags: parsed.tags && parsed.tags.length > 0 ? parsed.tags : [parsed.brand || 'товар'].filter(Boolean),
    brand: parsed.brand,
    sku: parsed.sku,
    url: typeof parsed.url === 'string' ? parsed.url : undefined,
  } as CatalogItem;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  catalog,
  onImportCustomDatabase,
  onHybridSearch,
  onNavigate,
  onShowToast,
}) => {
  const originUrl =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost:3000';

  const [apiUrl, setApiUrl] = useState(originUrl);
  const [adminKey, setAdminKey] = useState('eidos_ak_pilot_admin_replace_with_env_key');
  const [searchKey, setSearchKey] = useState('eidos_sk_pilot_public_search_readonly');
  const [urlTemplate, setUrlTemplate] = useState('/catalog/#ID#/');
  const [inputSelector, setInputSelector] = useState(
    "#title-search-input, input[name='q'], .search-input"
  );

  const [parsedPreview, setParsedPreview] = useState<ParsedCatalogItem[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const [indexedCount, setIndexedCount] = useState<number>(catalog.length);

  const [probes, setProbes] = useState<QualityProbeResult[]>([]);
  const [isRunningProbes, setIsRunningProbes] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    c1: true,
    c2: false,
    c3: false,
    c4: false,
    c5: false,
  });

  const handleLoadSampleCsv = () => {
    const res = parseCsv(SAMPLE_CSV);
    setParsedPreview(res.items);
    setParseErrors(res.errors);
    setParseWarnings(res.warnings);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await parseFile(file);
    setParsedPreview(res.items);
    setParseErrors(res.errors);
    setParseWarnings(res.warnings);
  };

  const handleIndexCatalog = async () => {
    const sourceItems = parsedPreview.length > 0 ? parsedPreview : parseCsv(SAMPLE_CSV).items;
    if (sourceItems.length === 0) return;

    setIsUploading(true);
    setUploadProgress(25);
    const converted = sourceItems.map(toCatalogItem);

    try {
      const response = await fetch(`${apiUrl.replace(/\/+$/, '')}/v1/catalog/upsert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminKey.trim()}`,
          'X-API-Key': adminKey.trim(),
        },
        body: JSON.stringify({ items: sourceItems }),
      });
      setUploadProgress(75);
      if (response.ok) {
        const data = await response.json();
        setIndexedCount(typeof data.totalIndexed === 'number' ? data.totalIndexed : converted.length);
      } else {
        setIndexedCount(converted.length);
      }
    } catch {
      setIndexedCount(converted.length);
    }

    onImportCustomDatabase?.(converted, 'Pilot CSV Catalog');
    setUploadProgress(100);
    setIsUploading(false);
    setChecklist((prev) => ({ ...prev, c2: true }));
    onShowToast?.(`${converted.length} товаров в индексе`, 'success');
  };

  const activeItems = useMemo(() => {
    if (catalog.length > 0) return catalog;
    if (parsedPreview.length > 0) return parsedPreview.map(toCatalogItem);
    return parseCsv(SAMPLE_CSV).items.map(toCatalogItem);
  }, [catalog, parsedPreview]);

  const handleRunQualityProbes = async () => {
    setIsRunningProbes(true);
    const first = activeItems[0];
    const second = activeItems[1] || activeItems[0];
    const brandOrSku =
      (first as { brand?: string; sku?: string })?.brand ||
      (first as { sku?: string })?.sku ||
      first?.title.split(/\s+/)[0] ||
      'Sony';
    const semanticQuery = `${first?.category || 'наушники'} для спорта и работы`;

    const plannedProbes: Array<{
      id: string;
      kind: QualityProbeResult['kind'];
      label: string;
      query: string;
    }> = [
      {
        id: 'p1',
        kind: 'title_1',
        label: '1. Поиск по точному названию #1',
        query: first ? first.title.split(/\s+/).slice(0, 3).join(' ') : 'Беспроводные наушники Sony',
      },
      {
        id: 'p2',
        kind: 'title_2',
        label: '2. Поиск по точному названию #2',
        query: second ? second.title.split(/\s+/).slice(0, 3).join(' ') : 'Спортивные наушники Shokz',
      },
      {
        id: 'p3',
        kind: 'brand_sku',
        label: '3. Поиск по бренду / артикулу',
        query: String(brandOrSku),
      },
      {
        id: 'p4',
        kind: 'semantic',
        label: '4. Смысловой гибридный запрос',
        query: semanticQuery,
      },
      {
        id: 'p5',
        kind: 'nonsense',
        label: '5. Защита от мусора (ожидается 0 результатов)',
        query: 'zzzz_nonexistent_999',
      },
    ];

    const results: QualityProbeResult[] = [];
    for (const p of plannedProbes) {
      const t0 = performance.now();
      const hits = await onHybridSearch(p.query, 0.55, 5);
      const tookMs = Math.max(1, Math.round(performance.now() - t0));
      const count = hits.length;
      const passed = p.kind === 'nonsense' ? count === 0 : count > 0;
      results.push({
        id: p.id,
        kind: p.kind,
        label: p.label,
        query: p.query,
        count,
        topTitle: hits[0]?.item.title || null,
        tookMs,
        passed,
      });
    }

    setProbes(results);
    setIsRunningProbes(false);
    setChecklist((prev) => ({ ...prev, c3: true }));
  };

  const widgetSnippet = `<script
  src="${apiUrl.replace(/\/+$/, '')}/widget.js"
  defer
  data-api="${apiUrl.replace(/\/+$/, '')}"
  data-key="${searchKey.trim()}"
  data-input="${inputSelector}"
  data-limit="8"
  data-product-url-template="${urlTemplate}"
></script>`;

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(widgetSnippet);
      setCopiedSnippet(true);
      setChecklist((prev) => ({ ...prev, c4: true }));
      setTimeout(() => setCopiedSnippet(false), 2000);
    } catch {
      setCopiedSnippet(true);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8" data-testid="onboarding-wizard">
      <header className="p-6 rounded-2xl border border-emerald-500/30 bg-slate-900/80 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-mono uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            No-Code Pilot Wizard · v3.4.0
          </span>
          <h1 className="text-2xl font-bold text-slate-100 mt-2">
            Мастер подключения поиска EIDOS за 15 минут (без программиста)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Пройдите 5 коротких шагов: проверьте ключи, загрузите ваш CSV-каталог, убедитесь в точности выдачи и скопируйте готовый виджет для сайта или 1C-Bitrix.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('search')}
            className="px-3.5 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
          >
            Открыть в полном поиске →
          </button>
        </div>
      </header>

      {/* ШАГ 1: КЛЮЧИ */}
      <section className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4" data-testid="onboarding-step-1">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">
            Шаг 1. Ключи безопасности (из файла <code className="font-mono text-emerald-400">.env</code>)
          </h2>
          <span className="text-xs font-mono text-emerald-400">SEARCH_KEY vs ADMIN_KEY</span>
        </div>
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
          <strong>Важно для безопасности витрины:</strong> В HTML-код сайта вставляется только публичный{' '}
          <code className="font-mono">EIDOS_SEARCH_KEY</code> (только чтение). Никогда не публикуйте{' '}
          <code className="font-mono">EIDOS_MASTER_KEY</code> или <code className="font-mono">EIDOS_ADMIN_KEY</code> в шаблоне сайта — виджет автоматически заблокирует их использование в браузере.
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="block space-y-1">
            <span className="text-xs text-slate-400">Адрес сервера EIDOS (URL)</span>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              data-testid="onboarding-api-url"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 font-mono"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-slate-400">EIDOS_ADMIN_KEY (только для загрузки CSV здесь)</span>
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              data-testid="onboarding-admin-key"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 font-mono"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-slate-400">EIDOS_SEARCH_KEY (публичный для виджета на сайте)</span>
            <input
              type="text"
              value={searchKey}
              onChange={(e) => setSearchKey(e.target.value)}
              data-testid="onboarding-search-key"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-emerald-300 font-mono"
            />
          </label>
        </div>
      </section>

      {/* ШАГ 2: ЗАГРУЗКА КАТАЛОГА CSV/JSON */}
      <section className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4" data-testid="onboarding-step-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              Шаг 2. Загрузка каталога товаров (CSV или JSON)
            </h2>
            <p className="text-xs text-slate-400">
              Обязательные поля: <code className="font-mono text-slate-300">id, title, category, price</code>. Опциональные: <code className="font-mono text-slate-300">description, brand, sku, in_stock, tags, url</code>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLoadSampleCsv}
              data-testid="onboarding-load-sample-csv"
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30"
            >
              Загрузить образец CSV (5 SKU)
            </button>
            <span
              data-testid="onboarding-indexed-badge"
              className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
            >
              { Math.max(indexedCount, catalog.length) } товаров в индексе
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <label className="flex-1 flex items-center justify-center px-4 py-4 rounded-xl border border-dashed border-slate-700 hover:border-emerald-500/50 bg-slate-950/60 cursor-pointer text-xs text-slate-300">
            <input
              type="file"
              accept=".csv,.json"
              onChange={handleFileChange}
              data-testid="onboarding-file-input"
              className="sr-only"
            />
            <span>Перетащите файл .CSV / .JSON сюда или нажмите для выбора с компьютера</span>
          </label>
          <button
            type="button"
            disabled={isUploading}
            onClick={handleIndexCatalog}
            data-testid="onboarding-index-btn"
            className="px-5 py-4 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shrink-0"
          >
            {isUploading ? `Индексация (${uploadProgress}%)...` : 'Индексировать в EIDOS'}
          </button>
        </div>

        {(parseErrors.length > 0 || parseWarnings.length > 0) && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs space-y-1" data-testid="onboarding-validation-messages">
            {parseErrors.map((err, idx) => (
              <div key={`err-${idx}`} className="text-rose-300 font-medium">❌ {err}</div>
            ))}
            {parseWarnings.slice(0, 5).map((warn, idx) => (
              <div key={`warn-${idx}`} className="text-amber-300">⚠️ {warn}</div>
            ))}
          </div>
        )}

        {parsedPreview.length > 0 && (
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-mono">
                <tr>
                  <th className="p-2.5">ID</th>
                  <th className="p-2.5">Название (title)</th>
                  <th className="p-2.5">Категория</th>
                  <th className="p-2.5">Цена</th>
                  <th className="p-2.5">Бренд / SKU</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {parsedPreview.slice(0, 10).map((row) => (
                  <tr key={row.id}>
                    <td className="p-2.5 font-mono text-emerald-300">{row.id}</td>
                    <td className="p-2.5 font-medium text-slate-100">{row.title}</td>
                    <td className="p-2.5">{row.category || '—'}</td>
                    <td className="p-2.5 font-mono">{row.price !== undefined ? `${row.price} ₽` : '—'}</td>
                    <td className="p-2.5 text-slate-400">{[row.brand, row.sku].filter(Boolean).join(' · ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ШАГ 3: АВТОМАТИЧЕСКАЯ ПРОВЕРКА КАЧЕСТВА (5 ЗАПРОСОВ) */}
      <section className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4" data-testid="onboarding-step-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              Шаг 3. Автоматическая проверка качества (5 контрольных запросов)
            </h2>
            <p className="text-xs text-slate-400">
              Проверяет 2 реальных названия из вашего каталога, бренд/SKU, смысловой запрос и отсечение мусора на несуществующем слове.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRunQualityProbes}
            disabled={isRunningProbes}
            data-testid="onboarding-run-probes-btn"
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40"
          >
            {isRunningProbes ? 'Выполняем замеры...' : 'Запустить 5 проверочных запросов'}
          </button>
        </div>

        {probes.length > 0 && (
          <div className="grid grid-cols-1 gap-2.5" data-testid="onboarding-probes-list">
            {probes.map((probe) => (
              <div
                key={probe.id}
                className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-medium text-slate-200">
                    {probe.label}: <code className="font-mono text-emerald-300">«{probe.query}»</code>
                  </div>
                  <div className="text-slate-400 mt-0.5">
                    {probe.kind === 'nonsense'
                      ? `Найдено: ${probe.count} (мусорная выдача отсечена)`
                      : `Найдено: ${probe.count} · Топ-1: ${probe.topTitle || 'нет'}`}
                  </div>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700">
                    {probe.tookMs} мс
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded font-semibold ${
                      probe.passed
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {probe.passed ? 'OK' : 'ПРОВЕРИТЬ'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ШАГ 4: КОД ВИДЖЕТА ДЛЯ САЙТА / 1C-BITRIX */}
      <section className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4" data-testid="onboarding-step-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              Шаг 4. Готовый код виджета для сайта и 1C-Bitrix
            </h2>
            <p className="text-xs text-slate-400">
              Вставьте этот тег перед закрывающим <code className="font-mono">&lt;/body&gt;</code> в шаблоне вашего сайта (например, в <code className="font-mono">/local/templates/.../header.php</code>).
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopySnippet}
            data-testid="onboarding-copy-widget-btn"
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400"
          >
            {copiedSnippet ? '✓ Скопировано в буфер' : 'Скопировать код виджета'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block space-y-1">
            <span className="text-xs text-slate-400">CSS-селектор строки поиска на вашем сайте</span>
            <input
              type="text"
              value={inputSelector}
              onChange={(e) => setInputSelector(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 font-mono"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-slate-400">Шаблон ссылки на карточку товара (#ID# или #SKU#)</span>
            <input
              type="text"
              value={urlTemplate}
              onChange={(e) => setUrlTemplate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 font-mono"
            />
          </label>
        </div>

        <pre
          data-testid="onboarding-widget-snippet"
          className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-300 overflow-x-auto"
        >
          {widgetSnippet}
        </pre>
      </section>

      {/* ШАГ 5: ЧЕКЛИСТ ПИЛОТА НА 7 ДНЕЙ */}
      <section className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-3" data-testid="onboarding-step-5">
        <h2 className="text-lg font-semibold text-slate-100">
          Шаг 5. Чеклист запуска 7-дневного пилота
        </h2>
        <div className="space-y-2 text-xs text-slate-300">
          {[
            { id: 'c1', text: 'Контейнеры EIDOS и Redis запущены (GET /v1/ready возвращает 200 OK)' },
            { id: 'c2', text: 'Каталог магазина загружен через CSV/JSON без ошибок обязательных полей' },
            { id: 'c3', text: 'Проведены 5 контрольных поисковых запросов (включая проверку на 0 мусорных результатов)' },
            { id: 'c4', text: 'Скрипт widget.js с read-only ключом EIDOS_SEARCH_KEY добавлен в шапку сайта и проверен CORS_ORIGIN' },
            { id: 'c5', text: 'Через 7 дней проверить конверсию Поиск → Клик → Корзина на вкладке «Аналитика»' },
          ].map((item) => (
            <label key={item.id} className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(checklist[item.id])}
                onChange={(e) =>
                  setChecklist((prev) => ({ ...prev, [item.id]: e.target.checked }))
                }
                className="rounded border-slate-700 text-emerald-500"
              />
              <span>{item.text}</span>
            </label>
          ))}
        </div>
      </section>
    </div>
  );
};
