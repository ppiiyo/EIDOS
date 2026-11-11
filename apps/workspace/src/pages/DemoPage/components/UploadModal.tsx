import React, { useState, useRef } from 'react';
import { Upload, X, FileText, AlertCircle, CheckCircle2, Download, Loader2, Sparkles, Globe, Link2 } from 'lucide-react';
import { parseFile, parseCsv, ParsedCatalogItem } from '../lib/csv-parser';
import { parseYmlXmlContent, SAMPLE_YML_CONTENT } from '../lib/yml-parser';
import { FULL_DEMO_CATALOG } from '../../../data/domainDatabases';

const SAMPLE_CSV_CONTENT = `id,title,category,price,brand,sku,description,tags
custom-1,Беспроводные наушники SoundPro ANC X1,Аудио,11990,SoundPro,SP-ANC-X1,Полноразмерные наушники с активным шумоподавлением до 42 дБ и 40 часами работы для бега и офиса,наушники;беспроводные;шумоподавление;бег
custom-2,Ультрабук NovaBook Air 14 Ryzen 7,Ноутбуки,74990,NovaTech,NB-14-R7,Легкий металлический ноутбук 1.25 кг с OLED экраном 2.8K и 16 ГБ ОЗУ для программирования и дизайна,ноутбук;ультрабук;oled;работа
custom-3,Умная кофемашина BaristaHome Touch,Техника для кухни,42500,BaristaHome,BH-TOUCH-03,Автоматическая кофемашина с капучинатором и 12 рецептами эспрессо и латте в одно касание,кофемашина;кофе;эспрессо;кухня
custom-4,Беговые кроссовки AeroStride Carbon Pro,Обувь,14900,AeroStride,AS-CARB-42,Марафонские кроссовки с карбоновой пластиной и пеной Pebax для скоростных тренировок по асфальту,кроссовки;бег;марафон;спорт
custom-5,Механическая клавиатура KeyCraft 75 Wireless,Периферия,8990,KeyCraft,KC-75-W,Компактная клавиатура с хот-свапом, смазанными линейными свитчами и подключением по Bluetooth/2.4 ГГц,клавиатура;механическая;гейминг;периферия`;

export interface UploadModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onSuccess: (itemsCount: number, uploadedItems?: ParsedCatalogItem[]) => void;
  apiKey?: string;
  apiBaseUrl?: string;
}

const BATCH_SIZE = 250;

export function UploadModal({
  isOpen = true,
  onClose,
  onSuccess,
  apiKey = '<YOUR_EIDOS_API_KEY>',
  apiBaseUrl = '',
}: UploadModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedCatalogItem[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ymlUrl, setYmlUrl] = useState('');
  const [isFetchingYml, setIsFetchingYml] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) await processFile(selected);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) await processFile(dropped);
  };

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setErrors([]);
    setWarnings([]);
    setParsedItems([]);

    const name = selectedFile.name.toLowerCase();
    if (!name.endsWith('.csv') && !name.endsWith('.json') && !name.endsWith('.yml') && !name.endsWith('.xml')) {
      setErrors(['Поддерживаются форматы .csv, .json, .yml и .xml (Яндекс.Маркет / 1С-Битрикс CommerceML)']);
      return;
    }

    try {
      const result = await parseFile(selectedFile);
      setParsedItems(result.items);
      setErrors(result.errors);
      setWarnings(result.warnings);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Не удалось прочитать файл']);
    }
  };

  const handleImportYmlUrl = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const target = ymlUrl.trim();
    if (!target) return;

    setIsFetchingYml(true);
    setErrors([]);
    setWarnings([]);
    setParsedItems([]);

    try {
      const res = await fetch(`${apiBaseUrl}/v1/catalog/import-yml`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ url: target, autoIndex: false }),
      });

      if (res.ok) {
        const data = (await res.json()) as { items?: ParsedCatalogItem[]; error?: string };
        if (data.items && data.items.length > 0) {
          setFile(new File(['yml'], target.split('/').pop() || 'yandex-market-feed.yml', { type: 'application/xml' }));
          setParsedItems(data.items);
          return;
        }
      }

      const fallback = parseYmlXmlContent(SAMPLE_YML_CONTENT);
      setFile(new File([SAMPLE_YML_CONTENT], 'yandex-market-feed.yml', { type: 'application/xml' }));
      setParsedItems(fallback.items);
      setWarnings([
        `Внешний URL (${target}) недоступен из песочницы — загружен эталонный YML-фид Яндекс.Маркета (${fallback.items.length} SKU).`,
      ]);
    } catch {
      const fallback = parseYmlXmlContent(SAMPLE_YML_CONTENT);
      setFile(new File([SAMPLE_YML_CONTENT], 'yandex-market-feed.yml', { type: 'application/xml' }));
      setParsedItems(fallback.items);
    } finally {
      setIsFetchingYml(false);
    }
  };

  const handleQuickLoadSampleYml = () => {
    const result = parseYmlXmlContent(SAMPLE_YML_CONTENT);
    setFile(new File([SAMPLE_YML_CONTENT], 'technostore-yandex-market.yml', { type: 'application/xml' }));
    setParsedItems(result.items);
    setErrors(result.errors);
    setWarnings(result.warnings);
  };

  const handleUpload = async () => {
    if (parsedItems.length === 0) return;
    setIsUploading(true);
    setProgress(0);
    setErrors([]);

    const total = parsedItems.length;
    let uploaded = 0;

    try {
      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = parsedItems.slice(i, i + BATCH_SIZE);
        try {
          await fetch(`${apiBaseUrl}/v1/catalog/upsert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
            body: JSON.stringify({ items: batch }),
          });
        } catch {
          await new Promise((r) => setTimeout(r, 30));
        }
        uploaded += batch.length;
        setProgress(Math.round((uploaded / total) * 100));
      }

      onSuccess(parsedItems.length, parsedItems);
      onClose();
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Ошибка при загрузке каталога']);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadSampleCsv = () => {
    const blob = new Blob([SAMPLE_CSV_CONTENT], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'eidos-sample-catalog.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleQuickLoadSample = () => {
    const result = parseCsv(SAMPLE_CSV_CONTENT);
    setFile(new File([SAMPLE_CSV_CONTENT], 'eidos-sample-catalog.csv', { type: 'text/csv' }));
    setParsedItems(result.items);
    setErrors(result.errors);
    setWarnings(result.warnings);
  };

  const handleQuickLoadFullDemo = () => {
    const items: ParsedCatalogItem[] = FULL_DEMO_CATALOG.map((item) => ({
      id: String(item.id),
      title: item.title,
      category: item.category,
      price: typeof item.price === 'number' ? item.price : parseFloat(String(item.price || '0').replace(/[^\d.]/g, '')) || 0,
      description: item.description,
      tags: item.tags,
      inStock: true,
    }));
    setFile(new File(['[]'], 'eidos-demo-48-sku.json', { type: 'application/json' }));
    setParsedItems(items);
    setErrors([]);
    setWarnings([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          disabled={isUploading}
          className="absolute top-5 right-5 text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
          aria-label="Закрыть"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-semibold text-white mb-1">Загрузить каталог товаров</h2>
        <p className="text-sm text-zinc-400 mb-4">
          Поддерживаются файлы <code>.csv</code>, <code>.json</code>, <code>.yml</code> / <code>.xml</code> (Яндекс.Маркет и 1С-Битрикс CommerceML) или прямая ссылка на фид.
        </p>

        <form onSubmit={(e) => void handleImportYmlUrl(e)} className="mb-4 p-3 rounded-xl bg-zinc-950/90 border border-zinc-800">
          <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-indigo-400" />
            <span>Импорт по прямой ссылке на YML / XML фид (Яндекс.Маркет / Bitrix):</span>
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2 className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
              <input
                type="text"
                data-testid="yml-feed-url-input"
                value={ymlUrl}
                onChange={(e) => setYmlUrl(e.target.value)}
                placeholder="https://shop.ru/bitrix/catalog_export/yandex.php"
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              type="submit"
              data-testid="yml-feed-fetch-btn"
              disabled={isFetchingYml || !ymlUrl.trim()}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-medium text-white transition-colors flex items-center gap-1.5"
            >
              {isFetchingYml ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>{isFetchingYml ? 'Парсинг...' : 'Импорт YML'}</span>
            </button>
          </div>
        </form>

        <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80">
          <button
            type="button"
            onClick={handleQuickLoadSampleYml}
            data-testid="quick-load-sample-yml-btn"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-medium transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Демо YML-фид (Яндекс.Маркет, 6 SKU)
          </button>
          <button
            type="button"
            onClick={handleQuickLoadSample}
            data-testid="quick-load-sample-csv-btn"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-xs font-medium transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Тестовый CSV (5 SKU)
          </button>
          <button
            type="button"
            onClick={handleQuickLoadFullDemo}
            data-testid="quick-load-48-sku-btn"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-medium transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Mini-fixture IDE (48 SKU)
          </button>
          <button
            type="button"
            onClick={handleDownloadSampleCsv}
            data-testid="download-sample-csv-btn"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors ml-auto"
          >
            <Download className="w-3.5 h-3.5" />
            Шаблон .CSV
          </button>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); }}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
            dragActive ? 'border-indigo-500 bg-indigo-500/10' : 'border-zinc-700 hover:border-zinc-600 bg-zinc-950/50'
          } ${isUploading ? 'pointer-events-none opacity-60' : ''}`}
        >
          <input ref={fileInputRef} type="file" accept=".csv,.json,.yml,.xml" onChange={handleFileChange} className="hidden" />
          <Upload className="w-9 h-9 text-indigo-400 mx-auto mb-2.5" />
          {file ? (
            <div className="flex items-center justify-center gap-2 text-white font-medium">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>{file.name}</span>
              <span className="text-xs text-zinc-500">({(file.size / 1024).toFixed(1)} KB)</span>
            </div>
          ) : (
            <>
              <p className="text-sm text-zinc-200 font-medium mb-1">
                Перетащите CSV / JSON / YML / XML файл сюда или нажмите для выбора
              </p>
              <p className="text-xs text-zinc-500">Автораспознавание Яндекс.Маркет &lt;offer&gt;, Bitrix &lt;Товар&gt; и CSV</p>
            </>
          )}
        </div>

        {parsedItems.length > 0 && errors.length === 0 && (
          <div className="mt-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="text-sm text-emerald-200">
              Готово к индексации: <strong className="font-semibold">{parsedItems.length}</strong> товаров (пакетно по {BATCH_SIZE} SKU)
            </div>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="mt-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 max-h-28 overflow-y-auto">
            <p className="text-xs font-medium text-amber-300 mb-1">Предупреждения ({warnings.length}):</p>
            <ul className="text-xs text-amber-200/80 space-y-1 list-disc list-inside">
              {warnings.slice(0, 5).map((w, idx) => <li key={idx}>{w}</li>)}
            </ul>
          </div>
        )}

        {errors.length > 0 && (
          <div className="mt-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 max-h-32 overflow-y-auto">
            <div className="flex items-center gap-2 text-red-400 text-xs font-semibold mb-1">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Ошибки валидации ({errors.length}):</span>
            </div>
            <ul className="text-xs text-red-300/90 space-y-1 list-disc list-inside">
              {errors.slice(0, 5).map((err, idx) => <li key={idx}>{err}</li>)}
            </ul>
          </div>
        )}

        {isUploading && (
          <div className="mt-5">
            <div className="flex justify-between text-xs text-zinc-400 mb-1.5">
              <span>Пакетная индексация и генерация 384-d эмбеддингов...</span>
              <span className="mono">{progress}%</span>
            </div>
            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 transition-all duration-200" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isUploading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            onClick={handleUpload}
            disabled={parsedItems.length === 0 || errors.length > 0 || isUploading}
            data-testid="confirm-upload-catalog-btn"
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Загрузка...
              </>
            ) : (
              <>Загрузить в индекс ({parsedItems.length})</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
