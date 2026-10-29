import React, { useState, useRef, useCallback } from 'react';
import { parseFile, ParsedCatalogItem } from '../lib/csv-parser';

export interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (itemsCount: number, items?: ParsedCatalogItem[]) => void;
  apiKey?: string;
  apiBaseUrl?: string;
}

const BATCH_SIZE = 100;

const SAMPLE_CSV_CONTENT = `id,title,category,price,description,tags
custom-1,"Беспроводные наушники Sony WH-1000XM5",Аудио,29990,"Флагманские наушники с активным шумоподавлением ANC, 30 часов автономной работы, LDAC Bluetooth","наушники;sony;anc;bluetooth;музыка"
custom-2,"Механическая клавиатура Keychron Q1 Pro",Периферия,16900,"Алюминиевый корпус CNC, беспроводная QMK/VIA клавиатура, переключатели Gateron, Hot-Swap","клавиатура;keychron;механика;гейминг;офис"
custom-3,"Игровой монитор LG UltraGear 27 OLED 240Hz",Мониторы,64990,"OLED-матрица 2560x1440, время отклика 0.03 мс, частота 240 Гц, G-Sync и HDR10 для киберспорта","монитор;oled;240hz;гейминг;lg"
custom-4,"Умные часы Garmin Fenix 7X Sapphire Solar",Гаджеты,72990,"Мультиспортивные GPS-часы с солнечной зарядкой, сапфировым стеклом, картами и пульсоксиметром","часы;garmin;спорт;туризм;gps"
custom-5,"Кофемашина DeLonghi Magnifica Evo",Техника для дома,44990,"Автоматическая зерновая кофемашина с капучинатором LatteCrema для эспрессо, капучино и латте","кофемашина;delonghi;дом;кухня;кофе"
custom-6,"Ноутбук Apple MacBook Air 15 M3 16/512GB",Ноутбуки,139990,"Тонкий и бесшумный ноутбук с чипом M3, дисплеем Liquid Retina 15.3 дюйма и 18 часами работы","ноутбук;macbook;apple;работа;программирование"`;

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  apiKey = 'eidos_dev_key',
  apiBaseUrl = '',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetModalState = useCallback(() => {
    setIsDragging(false);
    setIsUploading(false);
    setProgress(0);
    setSelectedFileName(null);
    setErrors([]);
    setWarnings([]);
  }, []);

  const handleClose = useCallback(() => {
    if (isUploading) return;
    resetModalState();
    onClose();
  }, [isUploading, onClose, resetModalState]);

  const processFile = useCallback(
    async (file: File) => {
      setSelectedFileName(file.name);
      setErrors([]);
      setWarnings([]);
      setProgress(0);

      const lower = file.name.toLowerCase();
      if (!lower.endsWith('.csv') && !lower.endsWith('.json')) {
        setErrors(['Поддерживаются только файлы форматов .csv и .json']);
        return;
      }

      setIsUploading(true);
      try {
        const result = await parseFile(file);
        setWarnings(result.warnings);

        if (result.errors.length > 0 || result.items.length === 0) {
          setErrors(
            result.errors.length > 0
              ? result.errors
              : ['Файл не содержит валидных товаров для загрузки.']
          );
          setIsUploading(false);
          return;
        }

        const total = result.items.length;
        const totalBatches = Math.ceil(total / BATCH_SIZE);

        for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
          const start = batchIdx * BATCH_SIZE;
          const batch = result.items.slice(start, start + BATCH_SIZE);

          const response = await fetch(`${apiBaseUrl}/v1/catalog/upsert`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': apiKey,
            },
            body: JSON.stringify({ items: batch }),
          });

          if (!response.ok) {
            let errorMessage = `HTTP ${response.status}`;
            try {
              const errData = (await response.json()) as { error?: string; message?: string };
              errorMessage = errData.error || errData.message || errorMessage;
            } catch {
              // Ignore JSON parse error on error response
            }
            throw new Error(`Ошибка загрузки батча #${batchIdx + 1}: ${errorMessage}`);
          }

          const currentProgress = Math.round(((batchIdx + 1) / totalBatches) * 100);
          setProgress(currentProgress);
        }

        setIsUploading(false);
        onSuccess(result.items.length, result.items);
        resetModalState();
        onClose();
      } catch (err) {
        setIsUploading(false);
        setErrors([
          err instanceof Error ? err.message : 'Неизвестная ошибка при отправке каталога.',
        ]);
      }
    },
    [apiBaseUrl, apiKey, onClose, onSuccess, resetModalState]
  );

  const handleDownloadSampleCsv = useCallback(() => {
    const blob = new Blob([SAMPLE_CSV_CONTENT], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'eidos-sample-catalog.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (isUploading) return;
      const file = e.dataTransfer.files?.[0];
      if (file) {
        void processFile(file);
      }
    },
    [isUploading, processFile]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        void processFile(file);
      }
      e.target.value = '';
    },
    [processFile]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
      data-testid="demo-upload-modal"
    >
      <div className="w-full max-w-xl rounded-xl bg-[#1e293b] border border-slate-700 text-[#f1f5f9] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <h2 id="upload-modal-title" className="text-lg font-semibold text-[#f1f5f9]">
              Загрузка собственного каталога
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Поддерживаются файлы CSV и JSON (батч-отправка в /v1/catalog/upsert)
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isUploading}
            className="px-2.5 py-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-700/60 transition-colors disabled:opacity-50"
            aria-label="Закрыть модальное окно"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (!isUploading) setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              isDragging
                ? 'border-indigo-400 bg-indigo-950/30'
                : 'border-slate-600 bg-[#0f172a]/70 hover:border-slate-500'
            }`}
            data-testid="upload-dropzone"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json"
              onChange={handleFileChange}
              className="hidden"
              data-testid="upload-file-input"
            />
            <div className="text-base font-medium text-[#f1f5f9] mb-1">
              {selectedFileName
                ? `Выбран файл: ${selectedFileName}`
                : 'Перетащите CSV или JSON сюда или нажмите для выбора'}
            </div>
            <p className="text-xs text-slate-400">
              Обязательные поля: <code className="text-indigo-300">id</code>,{' '}
              <code className="text-indigo-300">title</code> · Опционально:{' '}
              <code className="text-slate-300">category, price, description, tags</code>
            </p>
          </div>

          {isUploading && (
            <div className="space-y-1.5" data-testid="upload-progress">
              <div className="flex justify-between text-xs text-slate-300">
                <span>Индексация и загрузка батчей...</span>
                <span className="font-mono">{progress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {errors.length > 0 && (
            <div
              className="rounded-lg bg-red-950/50 border border-red-800/80 p-3 text-xs text-red-200 space-y-1"
              data-testid="upload-errors"
            >
              <div className="font-semibold text-red-300">Ошибки проверки файла:</div>
              <ul className="list-disc list-inside space-y-0.5">
                {errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {warnings.length > 0 && (
            <div
              className="rounded-lg bg-amber-950/40 border border-amber-800/70 p-3 text-xs text-amber-200 space-y-1 max-h-28 overflow-y-auto"
              data-testid="upload-warnings"
            >
              <div className="font-semibold text-amber-300">
                Предупреждения ({warnings.length}):
              </div>
              <ul className="list-disc list-inside space-y-0.5">
                {warnings.slice(0, 5).map((warn, i) => (
                  <li key={i}>{warn}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-lg bg-[#0f172a] border border-slate-800 p-3.5 text-xs text-slate-300">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="font-medium text-slate-200">Пример формата CSV:</span>
              <button
                type="button"
                onClick={handleDownloadSampleCsv}
                data-testid="download-sample-csv-btn"
                className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
              >
                ⬇ Скачать шаблон CSV (6 SKU)
              </button>
            </div>
            <pre className="font-mono text-[11px] text-slate-400 overflow-x-auto leading-relaxed">
{`id,title,category,price,description,tags
sku-1,"Беспроводные наушники Sony",Аудио,14990,"Шумоподавление ANC, 30ч работы","anc;bluetooth;хит"
sku-2,"Механическая клавиатура Keychron",Периферия,8900,"Hot-swap переключатели, RGB","keychron;gaming"`}
            </pre>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-[#0f172a]/50 border-t border-slate-700">
          <button
            type="button"
            onClick={handleClose}
            disabled={isUploading}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-50"
          >
            Выбрать файл
          </button>
        </div>
      </div>
    </div>
  );
};
