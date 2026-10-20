import React, { useState } from 'react';
import { X, FileSpreadsheet, Upload, Download, CheckCircle2, AlertTriangle } from 'lucide-react';
import { parseCsvToConcepts, SecurityGuardrails } from '@eidos/core';
import { Project } from '../types';
import { CsvExportSection } from './modals/CsvExportSection';

interface CsvImporterModalProps {
  isOpen: boolean;
  project: Project;
  onClose: () => void;
  onImportConcepts: (
    concepts: Array<{ name: string; category?: string; notes?: string }>,
    replace: boolean
  ) => void;
  onShowToast?: (message: string, type?: 'info' | 'success' | 'error') => void;
}

const SAMPLE_CSV = `name,category,notes
"Квантовый процессор Eidos Q1","Электроника","Криогенный сопроцессор для 384-мерного векторного поиска"
"Нейроинтерфейс Cortex Link","Гаджеты","Неинвазивный BCI-обруч с низкой задержкой"
"Книга: Алгоритмы HNSW и графы","Книги","Практическое руководство по приближенному поиску ближайших соседей"`;

export const CsvImporterModal: React.FC<CsvImporterModalProps> = ({
  isOpen,
  project,
  onClose,
  onImportConcepts,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [csvText, setCsvText] = useState(SAMPLE_CSV);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const parsedPreview = (() => {
    try {
      return parseCsvToConcepts(csvText);
    } catch {
      return { concepts: [], errors: ['Invalid CSV format'], stats: { totalRows: 0, importedCount: 0, skippedDuplicateCount: 0 } };
    }
  })();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(String(reader.result || ''));
      setErrorMsg(null);
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    setErrorMsg(null);
    const result = parseCsvToConcepts(csvText);
    if (result.concepts.length === 0) {
      setErrorMsg(result.errors[0] || 'No valid rows found in CSV.');
      return;
    }

    const sanitized = result.concepts.map((c) => ({
      name: SecurityGuardrails.scanAndSanitize(c.name).sanitizedInput || c.name,
      category: c.category
        ? SecurityGuardrails.scanAndSanitize(c.category).sanitizedInput || c.category
        : 'Imported CSV',
      notes: c.notes
        ? SecurityGuardrails.scanAndSanitize(c.notes).sanitizedInput || c.notes
        : '',
    }));

    onImportConcepts(sanitized, replaceExisting);
    onClose();
  };

  const handleCopyCsv = (text: string) => {
    void navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
    onShowToast?.('CSV copied to clipboard', 'info');
  };

  const handleDownloadCsv = (text: string) => {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.toLowerCase().replace(/\s+/g, '_')}_catalog.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast?.('Downloaded RFC 4180 CSV export', 'success');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet size={18} className="text-[var(--accent)]" />
            <span className="font-bold text-base text-[var(--text)]">
              Enterprise CSV Importer & Exporter (RFC 4180)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('import')}
              className={
                activeTab === 'import' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'
              }
            >
              <Upload size={12} />
              <span>Import CSV</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('export')}
              className={
                activeTab === 'export' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'
              }
            >
              <Download size={12} />
              <span>Export CSV</span>
            </button>
            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {activeTab === 'export' ? (
            <CsvExportSection
              project={project}
              copied={copied}
              onCopy={handleCopyCsv}
              onDownload={handleDownloadCsv}
            />
          ) : (
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-[var(--text-sec)]">
                  Paste CSV with `name,category,notes` columns or upload `.csv`:
                </span>
                <label className="btn btn-secondary btn-sm cursor-pointer">
                  <Upload size={12} />
                  <span>Choose .csv File</span>
                  <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>

              <textarea
                rows={7}
                className="input mono text-xs"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
              />

              {errorMsg && (
                <div className="flex items-center gap-2 text-xs text-[var(--danger)] bg-[var(--danger)]/10 px-3 py-2 rounded">
                  <AlertTriangle size={14} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--border)]">
                <label className="flex items-center gap-2 text-xs text-[var(--text-sec)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={replaceExisting}
                    onChange={(e) => setReplaceExisting(e.target.checked)}
                  />
                  <span>Replace current catalog ({ parsedPreview.concepts.length } valid rows detected)</span>
                </label>

                <button type="button" className="btn btn-primary" onClick={handleConfirmImport}>
                  <CheckCircle2 size={14} />
                  <span>Import & Vectorize ({parsedPreview.concepts.length} items)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default CsvImporterModal;
