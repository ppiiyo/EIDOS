import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  FileText,
  Sparkles,
  Check,
  AlertCircle,
  Download,
  Search,
  Filter,
  ArrowRight,
  Layers,
  Database,
  RefreshCw,
  Info,
  Copy,
  CheckCheck,
  Share2,
} from 'lucide-react';
import { Concept, Project } from '../types';
import {
  parseSemanticConceptsCsv,
  detectDelimiter,
  generateCsvTemplate,
  exportConceptsToCsv,
  CsvExportOptions,
  ParsedCsvRow,
} from '@eidos/core';

export type CsvModalTab = 'upload' | 'paste' | 'templates' | 'export';

interface CsvImporterModalProps {
  isOpen: boolean;
  project: Project;
  initialTab?: CsvModalTab;
  onClose: () => void;
  onImportConcepts: (
    concepts: Array<{ name: string; category?: string; notes?: string }>,
    replace: boolean,
    autoAnalyze: boolean
  ) => void;
  onShowToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const CsvImporterModal: React.FC<CsvImporterModalProps> = ({
  isOpen,
  project,
  initialTab = 'upload',
  onClose,
  onImportConcepts,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<CsvModalTab>(initialTab);

  // Sync initial tab whenever opened
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Import State
  const [csvContent, setCsvContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [delimiterOverride, setDelimiterOverride] = useState<string>('auto');
  const [hasHeadersOverride, setHasHeadersOverride] = useState<boolean | 'auto'>('auto');
  const [nameColOverride, setNameColOverride] = useState<string>('auto');
  const [categoryColOverride, setCategoryColOverride] = useState<string>('auto');
  const [notesColOverride, setNotesColOverride] = useState<string>('auto');

  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [deduplicate, setDeduplicate] = useState<boolean>(true);
  const [autoAnalyze, setAutoAnalyze] = useState<boolean>(true);
  const [previewFilter, setPreviewFilter] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Export State
  const [exportDelimiter, setExportDelimiter] = useState<string>(',');
  const [exportIncludeHeaders, setExportIncludeHeaders] = useState<boolean>(true);
  const [exportIncludeBom, setExportIncludeBom] = useState<boolean>(true);
  const [exportIncludeCategory, setExportIncludeCategory] = useState<boolean>(true);
  const [exportIncludeNotes, setExportIncludeNotes] = useState<boolean>(true);
  const [exportIncludeId, setExportIncludeId] = useState<boolean>(false);
  const [exportCategoryFilter, setExportCategoryFilter] = useState<string>('all');
  const [exportSearch, setExportSearch] = useState<string>('');
  const [exportPreviewMode, setExportPreviewMode] = useState<'grid' | 'raw'>('grid');
  const [copied, setCopied] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize with sample tech CSV template when opened if empty
  useEffect(() => {
    if (isOpen && !csvContent) {
      setCsvContent(generateCsvTemplate('tech'));
      setFileName('sample_ai_concepts.csv');
    }
  }, [isOpen]);

  // Compute parsing results for import
  const parseResult = useMemo(() => {
    if (!csvContent.trim()) {
      return null;
    }

    const detectedDelim =
      delimiterOverride === 'auto'
        ? detectDelimiter(csvContent)
        : delimiterOverride;

    const options: any = {
      delimiter: detectedDelim,
      deduplicate,
    };

    if (hasHeadersOverride !== 'auto') {
      options.hasHeaders = hasHeadersOverride;
    }

    if (nameColOverride !== 'auto') {
      options.nameColumn = nameColOverride;
    }

    if (categoryColOverride !== 'auto' && categoryColOverride !== '__none__') {
      options.categoryColumn = categoryColOverride;
    } else if (categoryColOverride === '__none__') {
      options.categoryColumn = -1;
    }

    if (notesColOverride !== 'auto' && notesColOverride !== '__none__') {
      options.notesColumn = notesColOverride;
    } else if (notesColOverride === '__none__') {
      options.notesColumn = -1;
    }

    return parseSemanticConceptsCsv(csvContent, options);
  }, [
    csvContent,
    delimiterOverride,
    hasHeadersOverride,
    nameColOverride,
    categoryColOverride,
    notesColOverride,
    deduplicate,
  ]);

  // Categories list for project export
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const c of project.concepts) {
      if (c.category) cats.add(c.category);
    }
    return Array.from(cats).sort();
  }, [project.concepts]);

  // Filtered concepts for export
  const filteredExportConcepts = useMemo(() => {
    return project.concepts.filter((c) => {
      if (exportCategoryFilter !== 'all') {
        if ((c.category || '__uncategorized__') !== exportCategoryFilter) {
          return false;
        }
      }
      if (exportSearch.trim()) {
        const q = exportSearch.toLowerCase().trim();
        return (
          c.name.toLowerCase().includes(q) ||
          (c.category && c.category.toLowerCase().includes(q)) ||
          (c.notes && c.notes.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [project.concepts, exportCategoryFilter, exportSearch]);

  // Generated CSV string for export
  const exportCsvText = useMemo(() => {
    const columns: Array<'name' | 'category' | 'notes' | 'id'> = ['name'];
    if (exportIncludeCategory) columns.push('category');
    if (exportIncludeNotes) columns.push('notes');
    if (exportIncludeId) columns.unshift('id');

    return exportConceptsToCsv(filteredExportConcepts, {
      delimiter: exportDelimiter,
      includeHeaders: exportIncludeHeaders,
      includeBom: exportIncludeBom,
      columns,
    });
  }, [
    filteredExportConcepts,
    exportDelimiter,
    exportIncludeHeaders,
    exportIncludeBom,
    exportIncludeCategory,
    exportIncludeNotes,
    exportIncludeId,
  ]);

  if (!isOpen) return null;

  const handleFileUpload = (file: File) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || '';
      setCsvContent(text);
      setDelimiterOverride('auto');
      setHasHeadersOverride('auto');
      setNameColOverride('auto');
      setCategoryColOverride('auto');
      setNotesColOverride('auto');
      onShowToast(`Файл «${file.name}» успешно прочитан`, 'success');
    };
    reader.onerror = () => {
      onShowToast('Ошибка при чтении файла', 'error');
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDownloadTemplate = (domain: 'tech' | 'retail' | 'finance' = 'tech') => {
    const content = generateCsvTemplate(domain);
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eidos_template_${domain}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast(`Шаблон eidos_template_${domain}.csv скачан`, 'info');
  };

  const handleLoadSample = (domain: 'tech' | 'retail' | 'finance') => {
    const sample = generateCsvTemplate(domain);
    setCsvContent(sample);
    setFileName(`template_${domain}.csv`);
    setDelimiterOverride('auto');
    setHasHeadersOverride('auto');
    setNameColOverride('auto');
    setCategoryColOverride('auto');
    setNotesColOverride('auto');
    onShowToast(`Загружен демонстрационный набор «${domain}»`, 'info');
  };

  const handleExecuteImport = () => {
    if (!parseResult || parseResult.concepts.length === 0) {
      onShowToast('Нет доступных концептов для импорта', 'error');
      return;
    }

    onImportConcepts(
      parseResult.concepts,
      importMode === 'replace',
      autoAnalyze
    );
    onClose();
  };

  // Download export CSV file
  const handleDownloadExportCsv = () => {
    if (filteredExportConcepts.length === 0) {
      onShowToast('Нет концептов для экспорта', 'error');
      return;
    }

    const ext = exportDelimiter === '\t' ? 'tsv' : 'csv';
    const dateStr = new Date().toISOString().slice(0, 10);
    const cleanProjectName = project.name
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]/gi, '_')
      .replace(/_+/g, '_');
    const filename = `eidos_${cleanProjectName}_${dateStr}.${ext}`;

    const mime =
      exportDelimiter === '\t'
        ? 'text/tab-separated-values;charset=utf-8;'
        : 'text/csv;charset=utf-8;';

    const blob = new Blob([exportCsvText], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast(`Файл «${filename}» успешно скачан`, 'success');
  };

  // Copy export CSV to clipboard
  const handleCopyExportCsv = async () => {
    if (!exportCsvText) return;
    try {
      await navigator.clipboard.writeText(exportCsvText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      onShowToast('CSV скопирован в буфер обмена', 'success');
    } catch {
      onShowToast('Не удалось скопировать в буфер обмена', 'error');
    }
  };

  // Filter preview rows for import
  const filteredImportRows = (parseResult?.validRows || []).filter((r) => {
    if (!previewFilter.trim()) return true;
    const query = previewFilter.toLowerCase().trim();
    return (
      r.mapped.name.toLowerCase().includes(query) ||
      (r.mapped.category && r.mapped.category.toLowerCase().includes(query)) ||
      (r.mapped.notes && r.mapped.notes.toLowerCase().includes(query))
    );
  });

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[92vh] bg-[#0c0d18] border border-[#212338] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[#e8e8f0]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1c1e30] bg-[#101222]/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400/20 to-purple-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">
                  {activeTab === 'export'
                    ? 'Экспорт концептов в CSV'
                    : 'Импорт и Экспорт концептов CSV'}
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  {activeTab === 'export' ? 'Download CSV' : 'Bulk Ingestion'}
                </span>
              </div>
              <p className="text-xs text-[#8a8aa3] mt-0.5">
                Текущий проект:{' '}
                <strong className="text-cyan-300 font-medium">
                  «{project.name}»
                </strong>{' '}
                <span className="text-[#555570]">
                  ({project.concepts.length} концептов)
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Export Button in Header */}
            <button
              onClick={handleDownloadExportCsv}
              disabled={project.concepts.length === 0}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-mono font-medium transition-colors cursor-pointer disabled:opacity-40"
              title="Скачать текущие концепты в файл CSV"
            >
              <Download size={13} />
              <span>Скачать CSV ({project.concepts.length})</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6e7191] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Source Tabs */}
        <div className="flex items-center justify-between px-6 pt-3 border-b border-[#1c1e30] bg-[#0a0b14]/50 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'upload'
                  ? 'border-cyan-400 text-cyan-300 bg-[#121424]'
                  : 'border-transparent text-[#8a8aa3] hover:text-[#e8e8f0] hover:bg-white/[0.02]'
              }`}
            >
              <Upload size={14} />
              <span>📁 Загрузить файл (.csv / .tsv)</span>
            </button>

            <button
              onClick={() => setActiveTab('paste')}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'paste'
                  ? 'border-cyan-400 text-cyan-300 bg-[#121424]'
                  : 'border-transparent text-[#8a8aa3] hover:text-[#e8e8f0] hover:bg-white/[0.02]'
              }`}
            >
              <FileText size={14} />
              <span>📋 Вставить текст / Таблицу</span>
            </button>

            <button
              onClick={() => setActiveTab('templates')}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 cursor-pointer whitespace-nowrap ${
                activeTab === 'templates'
                  ? 'border-cyan-400 text-cyan-300 bg-[#121424]'
                  : 'border-transparent text-[#8a8aa3] hover:text-[#e8e8f0] hover:bg-white/[0.02]'
              }`}
            >
              <Sparkles size={14} />
              <span>💡 Шаблоны</span>
            </button>
          </div>

          {/* Dedicated Export Tab */}
          <button
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 cursor-pointer whitespace-nowrap ml-2 ${
              activeTab === 'export'
                ? 'border-purple-400 text-purple-300 bg-[#151226]'
                : 'border-transparent text-purple-400 hover:text-purple-300 hover:bg-purple-500/10'
            }`}
          >
            <Download size={14} />
            <span>📤 Экспорт в CSV ({project.concepts.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* ==================== TAB 4: EXPORT CONCEPTS TO CSV ==================== */}
          {activeTab === 'export' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Summary Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-purple-500/10 via-cyan-500/10 to-transparent border border-purple-500/20 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
                    <Download size={20} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-white">
                      Экспорт концептов проекта «{project.name}»
                    </h4>
                    <p className="text-xs text-[#8a8aa3] mt-0.5">
                      Сформируйте чистый CSV-файл для Excel, Google Таблиц, Notion или других аналитических систем.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs font-mono">
                  <div className="px-3 py-1.5 rounded-lg bg-[#0e101f] border border-[#21243e] text-purple-300">
                    Концептов: <strong className="text-white">{project.concepts.length}</strong>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-[#0e101f] border border-[#21243e] text-cyan-300">
                    Категорий: <strong className="text-white">{availableCategories.length || 1}</strong>
                  </div>
                </div>
              </div>

              {/* Export Settings Grid */}
              <div className="bg-[#111322] border border-[#1e2034] rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-cyan-300 flex items-center gap-2">
                    <Database size={15} />
                    <span>Параметры CSV файла</span>
                  </span>
                  <span className="text-[11px] text-[#8a8aa3]">
                    Выгружается: <strong className="text-white font-mono">{filteredExportConcepts.length}</strong> из {project.concepts.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  {/* Delimiter */}
                  <div>
                    <label className="block text-[11px] text-[#8a8aa3] mb-1 font-medium">
                      Разделитель ячеек:
                    </label>
                    <select
                      value={exportDelimiter}
                      onChange={(e) => setExportDelimiter(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#0a0b14] border border-[#212338] text-[#e8e8f0] focus:border-cyan-400 focus:outline-none cursor-pointer"
                    >
                      <option value=",">Запятая (,) — стандартный CSV</option>
                      <option value=";">Точка с запятой (;) — MS Excel</option>
                      <option value="&#9;">Табуляция (\t) — TSV файл</option>
                      <option value="|">Вертикальная черта (|)</option>
                    </select>
                  </div>

                  {/* Filter by Category */}
                  <div>
                    <label className="block text-[11px] text-[#8a8aa3] mb-1 font-medium">
                      Фильтр по категории:
                    </label>
                    <select
                      value={exportCategoryFilter}
                      onChange={(e) => setExportCategoryFilter(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#0a0b14] border border-[#212338] text-[#e8e8f0] focus:border-cyan-400 focus:outline-none cursor-pointer"
                    >
                      <option value="all">Все категории ({project.concepts.length})</option>
                      {availableCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat} (
                          {project.concepts.filter((c) => c.category === cat).length}
                          )
                        </option>
                      ))}
                      {project.concepts.some((c) => !c.category) && (
                        <option value="__uncategorized__">
                          Без категории (
                          {project.concepts.filter((c) => !c.category).length}
                          )
                        </option>
                      )}
                    </select>
                  </div>

                  {/* Search within export */}
                  <div>
                    <label className="block text-[11px] text-[#8a8aa3] mb-1 font-medium">
                      Поиск по концептам:
                    </label>
                    <div className="relative">
                      <Search
                        size={12}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#555570]"
                      />
                      <input
                        type="text"
                        value={exportSearch}
                        onChange={(e) => setExportSearch(e.target.value)}
                        placeholder="Поиск по имени или заметкам..."
                        className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-[#0a0b14] border border-[#212338] text-xs text-[#e8e8f0] focus:border-cyan-400 focus:outline-none placeholder-[#555570]"
                      />
                    </div>
                  </div>
                </div>

                {/* Column and formatting checkboxes */}
                <div className="pt-3 border-t border-[#1a1c2e] flex flex-wrap items-center justify-between gap-4 text-xs">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="text-[11px] text-[#8a8aa3]">Включить колонки:</span>
                    <label className="flex items-center gap-1.5 text-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={true}
                        disabled={true}
                        className="rounded accent-cyan-400"
                      />
                      <span className="text-cyan-300 font-medium">Имя (name)</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-[#e8e8f0] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exportIncludeCategory}
                        onChange={(e) => setExportIncludeCategory(e.target.checked)}
                        className="rounded accent-cyan-400"
                      />
                      <span>Категория (category)</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-[#e8e8f0] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exportIncludeNotes}
                        onChange={(e) => setExportIncludeNotes(e.target.checked)}
                        className="rounded accent-cyan-400"
                      />
                      <span>Заметки (notes)</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-[#e8e8f0] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exportIncludeId}
                        onChange={(e) => setExportIncludeId(e.target.checked)}
                        className="rounded accent-cyan-400"
                      />
                      <span>ID концепта (id)</span>
                    </label>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 text-[#e8e8f0] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={exportIncludeHeaders}
                        onChange={(e) => setExportIncludeHeaders(e.target.checked)}
                        className="rounded accent-cyan-400"
                      />
                      <span>Заголовки (Headers)</span>
                    </label>
                    <label
                      className="flex items-center gap-1.5 text-[#e8e8f0] cursor-pointer"
                      title="Вставляет специальную сигнатуру UTF-8 BOM, чтобы Excel корректно открывал русский текст"
                    >
                      <input
                        type="checkbox"
                        checked={exportIncludeBom}
                        onChange={(e) => setExportIncludeBom(e.target.checked)}
                        className="rounded accent-cyan-400"
                      />
                      <span className="text-emerald-300">UTF-8 BOM (для Excel)</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Preview Toggle & Live View */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white">
                      Предпросмотр экспорта ({filteredExportConcepts.length} строк)
                    </span>
                  </div>
                  <div className="flex items-center gap-1 bg-[#111322] p-0.5 rounded-lg border border-[#212338]">
                    <button
                      onClick={() => setExportPreviewMode('grid')}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                        exportPreviewMode === 'grid'
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : 'text-[#8a8aa3] hover:text-white'
                      }`}
                    >
                      Таблица
                    </button>
                    <button
                      onClick={() => setExportPreviewMode('raw')}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                        exportPreviewMode === 'raw'
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : 'text-[#8a8aa3] hover:text-white'
                      }`}
                    >
                      Сырой CSV
                    </button>
                  </div>
                </div>

                {exportPreviewMode === 'grid' ? (
                  <div className="border border-[#1e2034] rounded-xl overflow-hidden bg-[#0c0d18] max-h-56 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-[#111322] sticky top-0 text-[11px] text-[#8a8aa3] uppercase tracking-wider font-mono border-b border-[#1e2034]">
                        <tr>
                          <th className="py-2 px-3 w-10">#</th>
                          {exportIncludeId && <th className="py-2 px-3 w-28">ID</th>}
                          <th className="py-2 px-3">Концепт / Имя</th>
                          {exportIncludeCategory && <th className="py-2 px-3">Категория</th>}
                          {exportIncludeNotes && <th className="py-2 px-3">Заметки</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#151726]">
                        {filteredExportConcepts.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-[#666885]">
                              Нет концептов для экспорта по выбранным фильтрам
                            </td>
                          </tr>
                        ) : (
                          filteredExportConcepts.slice(0, 60).map((c, idx) => (
                            <tr key={c.id || idx} className="hover:bg-white/[0.02]">
                              <td className="py-2 px-3 text-[#555570] font-mono text-[10px]">
                                {idx + 1}
                              </td>
                              {exportIncludeId && (
                                <td className="py-2 px-3 text-[#555570] font-mono text-[10px]">
                                  {c.id}
                                </td>
                              )}
                              <td className="py-2 px-3 font-medium text-white">
                                {c.name}
                              </td>
                              {exportIncludeCategory && (
                                <td className="py-2 px-3">
                                  {c.category ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                                      {c.category}
                                    </span>
                                  ) : (
                                    <span className="text-[#555570] text-[10px]">—</span>
                                  )}
                                </td>
                              )}
                              {exportIncludeNotes && (
                                <td className="py-2 px-3 text-[#8a8aa3] text-[11px] max-w-xs truncate">
                                  {c.notes || '—'}
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="relative">
                    <textarea
                      readOnly
                      rows={8}
                      value={exportCsvText}
                      className="w-full p-3 rounded-xl bg-[#080911] border border-[#1e2034] text-xs text-[#e8e8f0] font-mono focus:outline-none resize-y"
                    />
                    <button
                      onClick={handleCopyExportCsv}
                      className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded bg-[#16182c] border border-[#2a2d48] text-cyan-300 hover:text-white text-xs font-mono flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copied ? <CheckCheck size={12} /> : <Copy size={12} />}
                      <span>{copied ? 'Скопировано!' : 'Копировать'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== TAB 1: FILE DROPZONE ==================== */}
          {activeTab === 'upload' && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-cyan-400 bg-cyan-500/10 shadow-[0_0_25px_rgba(0,229,255,0.2)]'
                  : 'border-[#26283e] hover:border-cyan-500/50 bg-[#111322]/50 hover:bg-[#111322]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />
              <div className="w-12 h-12 mx-auto rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-300 mb-3">
                <Upload size={24} />
              </div>
              <p className="font-semibold text-sm text-white">
                Перетащите CSV / TSV файл сюда или нажмите для выбора
              </p>
              <p className="text-xs text-[#8a8aa3] mt-1">
                Поддерживаются разделители: запятая (,), точка с запятой (;), табуляция, пайп (|)
              </p>
              {fileName && (
                <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
                  <FileSpreadsheet size={14} />
                  <span>{fileName}</span>
                  <span className="text-[#8a8aa3]">
                    ({(new Blob([csvContent]).size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ==================== TAB 2: RAW TEXT / EXCEL PASTE ==================== */}
          {activeTab === 'paste' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs text-[#8a8aa3]">
                <span>Вставьте строки в формате CSV (скопированные из Excel, Google Sheets или блокнота):</span>
                <span className="font-mono text-cyan-300">
                  Символов: {csvContent.length}
                </span>
              </div>
              <textarea
                rows={6}
                value={csvContent}
                onChange={(e) => {
                  setCsvContent(e.target.value);
                  setFileName('custom_pasted.csv');
                }}
                placeholder={`name,category,notes\nВекторный поиск,AI,"Поиск по близости смыслов"\nЭмбеддинг,NLP,"Dense 384-мерный вектор"`}
                className="w-full p-3.5 rounded-xl bg-[#090a12] border border-[#212338] text-xs text-[#e8e8f0] font-mono focus:outline-none focus:border-cyan-400 resize-y"
              />
            </div>
          )}

          {/* ==================== TAB 3: READY TEMPLATES ==================== */}
          {activeTab === 'templates' && (
            <div className="space-y-4">
              <p className="text-xs text-[#8a8aa3]">
                Выберите готовый отраслевой набор понятий для быстрого тестирования или скачайте файл-шаблон:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => handleLoadSample('tech')}
                  className="p-4 rounded-xl bg-[#111322] border border-[#212338] hover:border-cyan-500/50 hover:bg-[#14162a] text-left transition-all cursor-pointer group"
                >
                  <div className="text-cyan-400 font-bold text-sm mb-1 group-hover:text-cyan-300">
                    ⚡ AI & Data Science
                  </div>
                  <div className="text-[11px] text-[#8a8aa3]">
                    8 концептов: HNSW, LinUCB, Эмбеддинги, Knowledge Graph
                  </div>
                </button>

                <button
                  onClick={() => handleLoadSample('retail')}
                  className="p-4 rounded-xl bg-[#111322] border border-[#212338] hover:border-purple-500/50 hover:bg-[#14162a] text-left transition-all cursor-pointer group"
                >
                  <div className="text-purple-400 font-bold text-sm mb-1 group-hover:text-purple-300">
                    🛍️ Ритейл & E-commerce
                  </div>
                  <div className="text-[11px] text-[#8a8aa3]">
                    8 концептов: Персонализация, LTV, Cross-sell, Churn
                  </div>
                </button>

                <button
                  onClick={() => handleLoadSample('finance')}
                  className="p-4 rounded-xl bg-[#111322] border border-[#212338] hover:border-emerald-500/50 hover:bg-[#14162a] text-left transition-all cursor-pointer group"
                >
                  <div className="text-emerald-400 font-bold text-sm mb-1 group-hover:text-emerald-300">
                    💳 FinTech & Банки
                  </div>
                  <div className="text-[11px] text-[#8a8aa3]">
                    7 концептов: Скоринг, Антифрод, Open Banking, KYC
                  </div>
                </button>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-[#1c1e30]">
                <span className="text-xs text-[#8a8aa3]">
                  Нужен пустой шаблон с правильными заголовками?
                </span>
                <button
                  onClick={() => handleDownloadTemplate('tech')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Download size={13} />
                  <span>Скачать пустой шаблон .csv</span>
                </button>
              </div>
            </div>
          )}

          {/* PARSING & COLUMN MAPPING TOOLBAR (Visible on Import Tabs) */}
          {activeTab !== 'export' && parseResult && (
            <div className="bg-[#111322] border border-[#1e2034] rounded-xl p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-cyan-300 font-semibold">
                  <Database size={15} />
                  <span>Настройка распознавания колонок</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-[#8a8aa3]">
                  <span>
                    Разделитель:{' '}
                    <strong className="text-cyan-300 font-mono">
                      {parseResult.delimiter === '\t'
                        ? 'TAB'
                        : `«${parseResult.delimiter}»`}
                    </strong>
                  </span>
                  <span>
                    Заголовки:{' '}
                    <strong className="text-cyan-300">
                      {parseResult.hasHeaders ? 'Да (строка 1)' : 'Нет'}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Selectors grid */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                {/* Delimiter */}
                <div>
                  <label className="block text-[11px] text-[#8a8aa3] mb-1 font-medium">
                    Разделитель полей:
                  </label>
                  <select
                    value={delimiterOverride}
                    onChange={(e) => setDelimiterOverride(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#0a0b14] border border-[#212338] text-[#e8e8f0] focus:border-cyan-400 focus:outline-none cursor-pointer"
                  >
                    <option value="auto">Авто ({parseResult.delimiter === '\t' ? 'TAB' : parseResult.delimiter})</option>
                    <option value=",">Запятая (,)</option>
                    <option value=";">Точка с запятой (;)</option>
                    <option value="&#9;">Табуляция (\t)</option>
                    <option value="|">Пайп (|)</option>
                  </select>
                </div>

                {/* Name column */}
                <div>
                  <label className="block text-[11px] text-cyan-300 mb-1 font-medium">
                    Концепт / Термин *:
                  </label>
                  <select
                    value={nameColOverride}
                    onChange={(e) => setNameColOverride(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#0a0b14] border border-cyan-500/40 text-cyan-200 focus:border-cyan-400 focus:outline-none cursor-pointer font-medium"
                  >
                    <option value="auto">Авто-определение</option>
                    {parseResult.headers.map((h, i) => (
                      <option key={i} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category column */}
                <div>
                  <label className="block text-[11px] text-[#8a8aa3] mb-1 font-medium">
                    Категория (опция):
                  </label>
                  <select
                    value={categoryColOverride}
                    onChange={(e) => setCategoryColOverride(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#0a0b14] border border-[#212338] text-[#e8e8f0] focus:border-cyan-400 focus:outline-none cursor-pointer"
                  >
                    <option value="auto">Авто-определение</option>
                    <option value="__none__">— Не назначать —</option>
                    {parseResult.headers.map((h, i) => (
                      <option key={i} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Notes column */}
                <div>
                  <label className="block text-[11px] text-[#8a8aa3] mb-1 font-medium">
                    Описание / Заметки:
                  </label>
                  <select
                    value={notesColOverride}
                    onChange={(e) => setNotesColOverride(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#0a0b14] border border-[#212338] text-[#e8e8f0] focus:border-cyan-400 focus:outline-none cursor-pointer"
                  >
                    <option value="auto">Авто-определение</option>
                    <option value="__none__">— Не назначать —</option>
                    {parseResult.headers.map((h, i) => (
                      <option key={i} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* PREVIEW & STATS SECTION (Visible on Import Tabs) */}
          {activeTab !== 'export' && parseResult && (
            <div className="space-y-3">
              {/* Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-[#111322] border border-[#1e2034] flex flex-col">
                  <span className="text-[11px] text-[#8a8aa3]">Строк в файле</span>
                  <span className="text-lg font-bold text-white font-mono mt-0.5">
                    {parseResult.totalRows}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col">
                  <span className="text-[11px] text-emerald-400">Корректных концептов</span>
                  <span className="text-lg font-bold text-emerald-300 font-mono mt-0.5">
                    {parseResult.concepts.length}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col">
                  <span className="text-[11px] text-amber-400">Дубликатов</span>
                  <span className="text-lg font-bold text-amber-300 font-mono mt-0.5">
                    {parseResult.duplicatesCount}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex flex-col">
                  <span className="text-[11px] text-rose-400">Пропущено пустых</span>
                  <span className="text-lg font-bold text-rose-300 font-mono mt-0.5">
                    {parseResult.invalidRows.length}
                  </span>
                </div>
              </div>

              {/* Preview Table Header & Search */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Layers size={14} className="text-cyan-400" />
                  <span>Предпросмотр таблицы ({filteredImportRows.length})</span>
                </div>
                <div className="relative w-56">
                  <Search
                    size={12}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#555570]"
                  />
                  <input
                    type="text"
                    value={previewFilter}
                    onChange={(e) => setPreviewFilter(e.target.value)}
                    placeholder="Фильтр в предпросмотре..."
                    className="w-full pl-7 pr-3 py-1 rounded-lg bg-[#111322] border border-[#212338] text-xs text-[#e8e8f0] focus:border-cyan-400 focus:outline-none placeholder-[#555570]"
                  />
                </div>
              </div>

              {/* Preview Table Container */}
              <div className="border border-[#1e2034] rounded-xl overflow-hidden bg-[#0c0d18] max-h-56 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#111322] sticky top-0 text-[11px] text-[#8a8aa3] uppercase tracking-wider font-mono border-b border-[#1e2034]">
                    <tr>
                      <th className="py-2 px-3 w-10">#</th>
                      <th className="py-2 px-3">Концепт / Имя</th>
                      <th className="py-2 px-3">Категория</th>
                      <th className="py-2 px-3">Описание / Заметки</th>
                      <th className="py-2 px-3 w-24 text-right">Статус</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#151726]">
                    {filteredImportRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-[#666885]">
                          Нет данных для отображения
                        </td>
                      </tr>
                    ) : (
                      filteredImportRows.slice(0, 50).map((row, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="py-2 px-3 text-[#555570] font-mono text-[10px]">
                            {row.rowIndex}
                          </td>
                          <td className="py-2 px-3 font-medium text-white">
                            {row.mapped.name}
                          </td>
                          <td className="py-2 px-3">
                            {row.mapped.category ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                                {row.mapped.category}
                              </span>
                            ) : (
                              <span className="text-[#555570] text-[10px]">—</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-[#8a8aa3] text-[11px] max-w-xs truncate">
                            {row.mapped.notes || '—'}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {row.isDuplicate ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                ДУБЛИКАТ
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                ГОТОВ
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {filteredImportRows.length > 50 && (
                <p className="text-[11px] text-[#8a8aa3] text-right">
                  Показано первых 50 строк из {filteredImportRows.length}
                </p>
              )}
            </div>
          )}

          {/* IMPORT OPTIONS (Visible on Import Tabs) */}
          {activeTab !== 'export' && (
            <div className="pt-2 border-t border-[#1c1e30] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {/* Mode: Append vs Replace */}
              <div className="space-y-1.5">
                <span className="block text-[11px] text-[#8a8aa3] font-medium">
                  Режим импорта:
                </span>
                <div className="flex gap-2">
                  <label className="flex items-center gap-1.5 cursor-pointer text-[#e8e8f0]">
                    <input
                      type="radio"
                      name="importMode"
                      value="append"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      className="accent-cyan-400"
                    />
                    <span>Добавить к текущим</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[#e8e8f0]">
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="accent-cyan-400"
                    />
                    <span>Заменить все</span>
                  </label>
                </div>
              </div>

              {/* Deduplicate */}
              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer text-[#e8e8f0]">
                  <input
                    type="checkbox"
                    checked={deduplicate}
                    onChange={(e) => setDeduplicate(e.target.checked)}
                    className="rounded accent-cyan-400"
                  />
                  <span>Фильтровать дубликаты (case-insensitive)</span>
                </label>
              </div>

              {/* Auto Analyze */}
              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer text-[#e8e8f0]">
                  <input
                    type="checkbox"
                    checked={autoAnalyze}
                    onChange={(e) => setAutoAnalyze(e.target.checked)}
                    className="rounded accent-cyan-400"
                  />
                  <span className="text-cyan-300 font-medium">
                    ⚡ Пересчитать граф сразу после импорта
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#1c1e30] bg-[#101222]/80 flex items-center justify-between gap-4">
          {activeTab === 'export' ? (
            /* Export Mode Footer */
            <>
              <div className="text-xs text-[#8a8aa3]">
                Готово к выгрузке:{' '}
                <strong className="text-purple-300 font-mono font-bold">
                  {filteredExportConcepts.length}
                </strong>{' '}
                из {project.concepts.length} концептов в файл CSV / TSV
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyExportCsv}
                  disabled={filteredExportConcepts.length === 0}
                  className="px-4 py-2 rounded-xl border border-[#2a2d48] text-xs text-cyan-300 hover:text-white hover:bg-cyan-500/10 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                >
                  {copied ? <CheckCheck size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Скопировано!' : 'Копировать CSV'}</span>
                </button>

                <button
                  onClick={handleDownloadExportCsv}
                  disabled={filteredExportConcepts.length === 0}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-cyan-400 hover:from-purple-400 hover:to-cyan-300 text-black font-bold text-xs flex items-center gap-2 shadow-[0_0_20px_rgba(180,120,255,0.3)] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer transform active:scale-98"
                >
                  <Download size={14} />
                  <span>
                    Скачать CSV файл ({filteredExportConcepts.length})
                  </span>
                </button>
              </div>
            </>
          ) : (
            /* Import Mode Footer */
            <>
              <div className="text-xs text-[#8a8aa3]">
                {parseResult?.concepts.length ? (
                  <span>
                    Будет импортировано:{' '}
                    <strong className="text-white font-mono font-bold">
                      {parseResult.concepts.length} концептов
                    </strong>{' '}
                    в проект «{project.name}»
                  </span>
                ) : (
                  <span>Загрузите файл или вставьте строки CSV для продолжения</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-[#212338] text-xs text-[#8a8aa3] hover:text-white hover:bg-white/[0.04] transition-all cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  onClick={handleExecuteImport}
                  disabled={!parseResult || parseResult.concepts.length === 0}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-purple-600 hover:from-cyan-300 hover:to-purple-500 text-black font-bold text-xs flex items-center gap-2 shadow-[0_0_20px_rgba(0,229,255,0.3)] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer transform active:scale-98"
                >
                  <Upload size={14} />
                  <span>
                    Импортировать ({parseResult?.concepts.length || 0}) в проект
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
