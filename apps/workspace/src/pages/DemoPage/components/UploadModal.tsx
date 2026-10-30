import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, Download, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { parseFile, ParsedCatalogItem } from '../lib/csv-parser';

export interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (itemsCount: number, items?: ParsedCatalogItem[]) => void;
  apiKey?: string;
  apiBaseUrl?: string;
}

const BATCH_SIZE = 100;

const SAMPLE_CSV_CONTENT = `id,title,category,price,sku,brand,description,tags
custom-1,"Беспроводные наушники Sony WH-1000XM5",Аудио,29990,SNY-WH1000XM5,Sony,"Флагманские наушники с активным шумоподавлением ANC, 30 часов автономной работы, LDAC Bluetooth","наушники;sony;anc;bluetooth;музыка"
custom-2,"Механическая клавиатура Keychron Q1 Pro",Периферия,16900,KCH-Q1PRO,Keychron,"Алюминиевый корпус CNC, беспроводная QMK/VIA клавиатура, переключатели Gateron, Hot-Swap","клавиатура;keychron;механика;гейминг;офис"
custom-3,"Игровой монитор LG UltraGear 27 OLED 240Hz",Мониторы,64990,LG-27GR95QE,LG,"OLED-матрица 2560x1440, время отклика 0.03 мс, частота 240 Гц, G-Sync и HDR10 для киберспорта","монитор;oled;240hz;гейминг;lg"
custom-4,"Умные часы Garmin Fenix 7X Sapphire Solar",Гаджеты,72990,GRM-FENIX7X,Garmin,"Мультиспортивные GPS-часы с солнечной зарядкой, сапфировым стеклом, картами и пульсоксиметром","часы;garmin;спорт;бег;gps"
custom-5,"Кофемашина DeLonghi Magnifica Evo",Техника для дома,44990,DLG-ECAM290,DeLonghi,"Автоматическая зерновая кофемашина с капучинатором LatteCrema для эспрессо, капучино и латте","кофемашина;delonghi;дом;кухня;кофе"
custom-6,"Ноутбук Apple MacBook Air 15 M3 16/512GB",Ноутбуки,139990,APL-MBA15M3,Apple,"Тонкий и бесшумный ноутбук с чипом M3, дисплеем Liquid Retina 15.3 дюйма и 18 часами работы","ноутбук;macbook;apple;работа;программирование"
custom-7,"Беговые кроссовки Nike ZoomX Vaporfly Next%",Спорт и обувь,19990,NKE-ZMXVP,Nike,"Ультралегкие марафонские кроссовки с карбоновой пластиной и пеной ZoomX для бега и тренировок","кроссовки;бег;спорт;nike;марафон"
custom-8,"Эргономичное кресло Herman Miller Aeron",Мебель и офис,119000,HM-AERON-B,Herman Miller,"Дышащая сетка Pellicle, поддержка поясницы PostureFit SL для долгой работы за компьютером","кресло;офис;работа;эргономика;дом"`;

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
    a.download = 'eidos-custom-catalog-sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleQuickLoadSampleCsv = useCallback(() => {
    const sampleFile = new File([SAMPLE_CSV_CONTENT], 'eidos-custom-catalog-sample.csv', {
      type: 'text/csv',
    });
    void processFile(sampleFile);
  }, [processFile]);

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
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
      data-testid="demo-upload-modal"
      onClick={handleClose}
    >
      <div
        className="card w-full max-w-xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div>
            <h2 id="upload-modal-title" className="text-base font-bold text-[var(--text)]">
              Загрузка собственного каталога (CSV / JSON)
            </h2>
            <p className="text-xs text-[var(--text-sec)] mt-0.5">
              Батч-отправка в <code className="mono text-[var(--accent)]">POST /v1/catalog/upsert</code> и построение 384-d HNSW индекса
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isUploading}
            className="btn btn-secondary btn-sm"
            aria-label="Закрыть модальное окно"
          >
            <X size={14} />
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
            className={`cursor-pointer rounded-lg border-2 border-dashed p-7 text-center transition-colors ${
              isDragging
                ? 'border-[var(--accent)] bg-[var(--accent-bg)]'
                : 'border-[var(--border-hi)] bg-[var(--bg-alt)] hover:border-[var(--accent)]'
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
            <Upload size={24} className="mx-auto mb-2 text-[var(--accent)]" />
            <div className="text-sm font-semibold text-[var(--text)] mb-1">
              {selectedFileName
                ? `Выбран файл: ${selectedFileName}`
                : 'Перетащите CSV или JSON сюда или нажмите для выбора файла'}
            </div>
            <p className="text-xs text-[var(--text-sec)]">
              Обязательные поля: <code className="mono text-[var(--accent)]">id</code>,{' '}
              <code className="mono text-[var(--accent)]">title</code> · Опционально:{' '}
              <code className="mono">category, price, description, tags</code>
            </p>
          </div>

          {isUploading && (
            <div className="space-y-1.5" data-testid="upload-progress">
              <div className="flex justify-between text-xs text-[var(--text-sec)]">
                <span>Индексация 384-d векторов и загрузка батчей...</span>
                <span className="mono font-semibold text-[var(--accent)]">{progress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[var(--bg-alt)] border border-[var(--border)] overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {errors.length > 0 && (
            <div
              className="rounded-lg bg-[var(--error-bg)] border border-[var(--error)]/40 p-3 text-xs text-[var(--error)] space-y-1"
              data-testid="upload-errors"
            >
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle size={14} />
                <span>Ошибки проверки файла:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5">
                {errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {warnings.length > 0 && (
            <div
              className="rounded-lg bg-[var(--warning-bg)] border border-[var(--warning)]/40 p-3 text-xs text-[var(--warning)] space-y-1 max-h-28 overflow-y-auto"
              data-testid="upload-warnings"
            >
              <div className="font-semibold">Предупреждения ({warnings.length}):</div>
              <ul className="list-disc list-inside space-y-0.5">
                {warnings.slice(0, 5).map((warn, i) => (
                  <li key={i}>{warn}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-lg bg-[var(--bg-alt)] border border-[var(--border)] p-3.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="font-semibold text-[var(--text)]">Пример формата CSV:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadSampleCsv}
                  data-testid="download-sample-csv-btn"
                  className="btn btn-secondary btn-sm"
                >
                  <Download size={12} />
                  <span>Скачать шаблон CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handleQuickLoadSampleCsv}
                  data-testid="quick-load-sample-csv-btn"
                  disabled={isUploading}
                  className="btn btn-primary btn-sm"
                >
                  <Zap size={12} />
                  <span>Загрузить тестовый CSV (8 SKU)</span>
                </button>
              </div>
            </div>
            <pre className="mono text-[11px] text-[var(--text-sec)] overflow-x-auto leading-relaxed">
{`id,title,category,price,description,tags
custom-1,"Беспроводные наушники Sony WH-1000XM5",Аудио,29990,"Шумоподавление ANC, 30ч работы","наушники;sony;anc"
custom-2,"Механическая клавиатура Keychron Q1 Pro",Периферия,16900,"Алюминиевый корпус, Hot-Swap","клавиатура;keychron"`}
            </pre>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 bg-[var(--bg-alt)] border-t border-[var(--border)]">
          <button
            type="button"
            onClick={handleClose}
            disabled={isUploading}
            className="btn btn-secondary btn-sm"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="btn btn-primary btn-sm"
          >
            <CheckCircle2 size={13} />
            <span>Выбрать файл (.csv / .json)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
