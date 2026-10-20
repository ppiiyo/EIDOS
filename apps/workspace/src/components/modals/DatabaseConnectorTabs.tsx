import React from "react";
import { Upload, CheckCircle2, AlertTriangle, Code } from 'lucide-react';

interface CustomJsonTabProps {
  jsonInput: string;
  jsonError: string | null;
  onChangeJson: (val: string) => void;
  onLoadSample: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onApplyJson: () => void;
}

export const CustomJsonConnectorTab: React.FC<CustomJsonTabProps> = ({
  jsonInput,
  jsonError,
  onChangeJson,
  onLoadSample,
  onFileUpload,
  onApplyJson,
}) => (
  <div className="flex flex-col gap-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-xs text-[var(--text-sec)]">
        Paste array of items (RU / EN / JA / ZH) or upload a `.json` file:
      </span>
      <div className="flex items-center gap-2">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onLoadSample}>
          <Code size={12} />
          <span>Load Sample JSON</span>
        </button>
        <label className="btn btn-secondary btn-sm cursor-pointer">
          <Upload size={12} />
          <span>Upload .json</span>
          <input type="file" accept=".json" className="hidden" onChange={onFileUpload} />
        </label>
      </div>
    </div>

    <textarea
      rows={9}
      className="input mono text-xs"
      value={jsonInput}
      onChange={(e) => onChangeJson(e.target.value)}
      placeholder='[{"id":"1","title":"Quantum Camera","category":"Hardware","description":"..."}]'
    />

    {jsonError && (
      <div className="flex items-center gap-2 text-xs text-[var(--danger)] bg-[var(--danger)]/10 px-3 py-2 rounded">
        <AlertTriangle size={14} />
        <span>{jsonError}</span>
      </div>
    )}

    <div className="flex justify-end">
      <button type="button" className="btn btn-primary" onClick={onApplyJson}>
        <CheckCircle2 size={14} />
        <span>Vectorize & Load into HNSW</span>
      </button>
    </div>
  </div>
);
