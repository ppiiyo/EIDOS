import React from 'react';
import { Download, Copy, Check } from 'lucide-react';
import { exportConceptsToCsv } from '@eidos/core';
import { Project } from '../../types';

interface CsvExportSectionProps {
  project: Project;
  copied: boolean;
  onCopy: (csvText: string) => void;
  onDownload: (csvText: string) => void;
}

export const CsvExportSection: React.FC<CsvExportSectionProps> = ({
  project,
  copied,
  onCopy,
  onDownload,
}) => {
  const csvContent = exportConceptsToCsv(
    project.concepts.map((c) => ({
      name: c.name,
      category: c.category || 'General',
      notes: c.notes || '',
    }))
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--text-sec)]">
          RFC 4180 CSV Export ({project.concepts.length} items)
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onCopy(csvContent)}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy CSV'}</span>
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onDownload(csvContent)}
          >
            <Download size={12} />
            <span>Download .csv</span>
          </button>
        </div>
      </div>

      <pre className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--bg-alt)] text-xs mono overflow-auto max-h-[340px] text-[var(--text)] m-0">
        {csvContent}
      </pre>
    </div>
  );
};
