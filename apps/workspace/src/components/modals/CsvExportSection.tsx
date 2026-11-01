import React from 'react';
import { Copy, Check, Download } from 'lucide-react';
import { Project } from '../../types';

interface CsvExportSectionProps {
  project: Project;
  copied: boolean;
  onCopy: (csvContent: string) => void;
  onDownload: (csvContent: string) => void;
}

export const CsvExportSection: React.FC<CsvExportSectionProps> = ({
  project,
  copied,
  onCopy,
  onDownload,
}) => {
  const rows = ['name,category,notes'];
  for (const c of project.concepts) {
    const safeName = `"${(c.name || '').replace(/"/g, '""')}"`;
    const safeCat = `"${(c.category || 'General').replace(/"/g, '""')}"`;
    const safeNotes = `"${(c.notes || '').replace(/"/g, '""')}"`;
    rows.push(`${safeName},${safeCat},${safeNotes}`);
  }
  const csvContent = rows.join('\n');

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--text-sec)]">
          Exported {project.concepts.length} items in standard CSV format:
        </span>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onCopy(csvContent)}>
            {copied ? <Check size={12} /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy CSV'}</span>
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onDownload(csvContent)}>
            <Download size={12} />
            <span>Download .csv</span>
          </button>
        </div>
      </div>
      <pre className="p-3.5 rounded-lg bg-[var(--bg-alt)] border border-[var(--border)] mono text-xs overflow-auto max-h-64 text-[var(--text)]">
        {csvContent}
      </pre>
    </div>
  );
};
