import React from 'react';
import { Upload, CheckCircle2, AlertTriangle, Database } from 'lucide-react';

interface CustomJsonConnectorTabProps {
  jsonInput: string;
  jsonError: string | null;
  onChangeJson: (val: string) => void;
  onLoadSample: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onApplyJson: () => void;
}

export const CustomJsonConnectorTab: React.FC<CustomJsonConnectorTabProps> = ({
  jsonInput,
  jsonError,
  onChangeJson,
  onLoadSample,
  onFileUpload,
  onApplyJson,
}) => (
  <div className="flex flex-col gap-3.5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-xs text-[var(--text-sec)]">
        Paste JSON array of catalog items or upload a `.json` file:
      </span>
      <div className="flex items-center gap-2">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onLoadSample}>
          Load Sample JSON
        </button>
        <label className="btn btn-secondary btn-sm cursor-pointer">
          <Upload size={12} />
          <span>Upload .json</span>
          <input type="file" accept=".json,application/json" className="hidden" onChange={onFileUpload} />
        </label>
      </div>
    </div>

    <textarea
      rows={9}
      className="input mono text-xs"
      value={jsonInput}
      onChange={(e) => onChangeJson(e.target.value)}
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
        <span>Vectorize & Import JSON Catalog</span>
      </button>
    </div>
  </div>
);

export const DbSyncConnectorsTab: React.FC = () => (
  <div className="space-y-3">
    {[
      {
        name: 'PostgreSQL / pgvector CDC Connector',
        desc: 'Stream catalog rows from PostgreSQL into EIDOS 384-d HNSW index via `/v1/catalog/batch`',
        cmd: 'npx @eidos/cli sync-pg --url "$DATABASE_URL" --table products',
      },
      {
        name: '1C-Bitrix IBlock / YML Feed Sync',
        desc: 'Scheduled or webhook-driven catalog synchronization from 1C-Bitrix REST & YML feeds',
        cmd: 'curl -X POST http://localhost:3001/v1/catalog/import-yml -d \'{"url":"https://shop.ru/bitrix/catalog_export/yandex.php"}\'',
      },
    ].map((c) => (
      <div key={c.name} className="card p-4">
        <div className="flex items-center gap-2 font-semibold text-sm text-[var(--text)] mb-1">
          <Database size={14} className="text-[var(--accent)]" />
          <span>{c.name}</span>
        </div>
        <p className="text-xs text-[var(--text-sec)] mb-2">{c.desc}</p>
        <pre className="p-2.5 rounded bg-[var(--bg-alt)] border border-[var(--border)] mono text-xs overflow-x-auto text-[var(--text)]">
          {c.cmd}
        </pre>
      </div>
    ))}
  </div>
);
