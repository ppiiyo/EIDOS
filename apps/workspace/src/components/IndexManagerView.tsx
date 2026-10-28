import React, { useState, useEffect } from 'react';
import { Database, Plus, Trash2, Upload, Cpu, Layers, HardDrive, CheckCircle2 } from 'lucide-react';

export interface VectorIndexRecord {
  name: string;
  dimension: number;
  documentCount: number;
  quantization: 'fp32' | 'fp16' | 'int8' | 'binary';
  hnswConfig: { M: number; efConstruction: number; efSearch: number };
  shards: number;
  replicationFactor: number;
  memoryBytes: number;
  status: 'ready' | 'reindexing';
  createdAt: string;
}

const INITIAL_INDEXES: VectorIndexRecord[] = [
  {
    name: 'default',
    dimension: 384,
    documentCount: 5005,
    quantization: 'int8',
    hnswConfig: { M: 16, efConstruction: 128, efSearch: 64 },
    shards: 3,
    replicationFactor: 2,
    memoryBytes: 2562560,
    status: 'ready',
    createdAt: '2026-10-20T10:00:00.000Z',
  },
  {
    name: 'ecommerce-catalog',
    dimension: 384,
    documentCount: 1240,
    quantization: 'fp16',
    hnswConfig: { M: 24, efConstruction: 200, efSearch: 80 },
    shards: 3,
    replicationFactor: 2,
    memoryBytes: 1111040,
    status: 'ready',
    createdAt: '2026-10-24T14:30:00.000Z',
  },
];

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export const IndexManagerView: React.FC<{
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
  uiLang?: 'ru' | 'en' | 'ja';
}> = ({ onShowToast, uiLang = 'en' }) => {
  const isRu = uiLang === 'ru';
  const [indexes, setIndexes] = useState<VectorIndexRecord[]>(INITIAL_INDEXES);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDimension, setNewDimension] = useState(384);
  const [newQuantization, setNewQuantization] = useState<'fp32' | 'fp16' | 'int8' | 'binary'>('int8');
  const [newM, setNewM] = useState(16);
  const [newEfConstruction, setNewEfConstruction] = useState(128);
  const [selectedIndexForUpload, setSelectedIndexForUpload] = useState('default');
  const [bulkJsonPayload, setBulkJsonPayload] = useState(
    '[\n  {"id": "sku-901", "title": "Titanium ANC Headphones", "category": "Audio", "price": 299}\n]'
  );

  useEffect(() => {
    if (typeof fetch !== 'function') return;
    fetch('/v1/indexes')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.indexes) && data.indexes.length > 0) setIndexes(data.indexes);
      })
      .catch(() => {});
  }, []);

  const handleCreateIndex = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    if (!cleanName) return;
    const optimistic: VectorIndexRecord = {
      name: cleanName,
      dimension: newDimension,
      documentCount: 0,
      quantization: newQuantization,
      hnswConfig: { M: newM, efConstruction: newEfConstruction, efSearch: 64 },
      shards: 3,
      replicationFactor: 2,
      memoryBytes: 4096,
      status: 'ready',
      createdAt: new Date().toISOString(),
    };
    try {
      const res = await fetch('/v1/indexes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          dimension: newDimension,
          quantization: newQuantization,
          M: newM,
          efConstruction: newEfConstruction,
        }),
      });
      if (res.ok) {
        const body = await res.json();
        if (body.index) setIndexes((prev) => [...prev.filter((i) => i.name !== cleanName), body.index]);
      } else {
        setIndexes((prev) => [...prev.filter((i) => i.name !== cleanName), optimistic]);
      }
    } catch {
      setIndexes((prev) => [...prev.filter((i) => i.name !== cleanName), optimistic]);
    }
    setNewName('');
    setShowCreateForm(false);
    onShowToast?.(`Index '${cleanName}' created (${newDimension}d, ${newQuantization.toUpperCase()})`, 'success');
  };

  const handleDeleteIndex = async (name: string) => {
    if (name === 'default') return;
    try {
      await fetch(`/v1/indexes/${encodeURIComponent(name)}`, { method: 'DELETE' });
    } catch {}
    setIndexes((prev) => prev.filter((idx) => idx.name !== name));
    onShowToast?.(`Index '${name}' deleted`, 'info');
  };

  const handleBulkUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(bulkJsonPayload);
      const docs = Array.isArray(parsed) ? parsed : [parsed];
      const res = await fetch(`/v1/indexes/${encodeURIComponent(selectedIndexForUpload)}/documents`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ documents: docs }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.index) setIndexes((prev) => prev.map((i) => (i.name === data.index.name ? data.index : i)));
      } else {
        setIndexes((prev) =>
          prev.map((i) => (i.name === selectedIndexForUpload ? { ...i, documentCount: i.documentCount + docs.length } : i))
        );
      }
      onShowToast?.(`Uploaded ${docs.length} document(s) to '${selectedIndexForUpload}'`, 'success');
    } catch {
      onShowToast?.('Invalid JSON payload for bulk upload', 'error');
    }
  };

  return (
    <div className="page" data-testid="index-manager-view">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
        <div>
          <h1 className="page-title">
            {isRu ? '🗄️ Менеджер векторных индексов (HNSW Index Manager) и шардов' : '🗄️ HNSW Index Manager & Shards'}
          </h1>
          <p className="page-sub">
            {isRu
              ? 'Управление индексами HNSW, квантованием памяти (FP32 / FP16 / INT8 / Binary) и пакетной загрузкой документов'
              : 'Manage vector indexes, quantization (FP32 / FP16 / INT8 / Binary), and bulk ingestion'}
          </p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" data-testid="open-create-index-btn" onClick={() => setShowCreateForm((v) => !v)}>
          <Plus size={14} /> {isRu ? 'Создать новый индекс' : 'Create New Index'}
        </button>
      </div>

      {showCreateForm && (
        <form onSubmit={handleCreateIndex} className="card p-5 mb-5" data-testid="create-index-form">
          <h3 className="text-base font-semibold mb-3">{isRu ? 'Создание векторного индекса HNSW' : 'Create HNSW Vector Index'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1">{isRu ? 'Имя индекса' : 'Index Name'}</label>
              <input className="input" data-testid="input-index-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="products-v2" required />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">{isRu ? 'Размерность (Dimensions)' : 'Dimensions'}</label>
              <input type="number" className="input" value={newDimension} onChange={(e) => setNewDimension(Number(e.target.value))} min={8} max={4096} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">{isRu ? 'Квантование' : 'Quantization'}</label>
              <select className="input" data-testid="select-quantization" value={newQuantization} onChange={(e) => setNewQuantization(e.target.value as any)}>
                <option value="fp32">{isRu ? 'FP32 (Полная точность)' : 'FP32 (Full Precision)'}</option>
                <option value="fp16">{isRu ? 'FP16 (Сжатие 2x)' : 'FP16 (2x Compression)'}</option>
                <option value="int8">{isRu ? 'INT8 Scalar (Сжатие 4x)' : 'INT8 Scalar (4x Compression)'}</option>
                <option value="binary">{isRu ? 'Binary 1-bit (Сжатие 32x)' : 'Binary 1-bit (32x Compression)'}</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">HNSW M</label>
              <input type="number" className="input" value={newM} onChange={(e) => setNewM(Number(e.target.value))} min={4} max={128} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">efConstruction</label>
              <input type="number" className="input" value={newEfConstruction} onChange={(e) => setNewEfConstruction(Number(e.target.value))} min={16} max={512} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button type="submit" className="btn btn-primary btn-sm" data-testid="submit-create-index">{isRu ? 'Создать индекс' : 'Provision Index'}</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCreateForm(false)}>{isRu ? 'Отмена' : 'Cancel'}</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6" data-testid="indexes-grid">
        {indexes.map((idx) => (
          <div key={idx.name} className="card p-5 flex flex-col justify-between gap-3" data-testid={`index-card-${idx.name}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Database size={18} color="var(--accent)" />
                <div>
                  <h3 className="text-base font-semibold m-0 mono">{idx.name}</h3>
                  <span className="text-xs text-[var(--text-sec)]">{idx.shards} {isRu ? 'Шарда' : 'Shards'} · RF={idx.replicationFactor}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge badge-success mono flex items-center gap-1"><CheckCircle2 size={11} /> {idx.status.toUpperCase()}</span>
                {idx.name !== 'default' && (
                  <button type="button" className="btn btn-danger btn-sm" data-testid={`delete-index-${idx.name}`} onClick={() => handleDeleteIndex(idx.name)}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border)] text-xs">
              <div>
                <span className="text-[var(--text-sec)] flex items-center gap-1"><Layers size={12} /> {isRu ? 'Документы' : 'Documents'}</span>
                <div className="mono font-bold text-sm mt-0.5">{idx.documentCount.toLocaleString()}</div>
              </div>
              <div>
                <span className="text-[var(--text-sec)] flex items-center gap-1"><Cpu size={12} /> {isRu ? 'Квантование' : 'Quantization'}</span>
                <div className="mono font-bold text-sm mt-0.5">{idx.quantization.toUpperCase()} ({idx.dimension}d)</div>
              </div>
              <div>
                <span className="text-[var(--text-sec)] flex items-center gap-1"><HardDrive size={12} /> {isRu ? 'Память RAM' : 'RAM Usage'}</span>
                <div className="mono font-bold text-sm mt-0.5">{formatBytes(idx.memoryBytes)}</div>
              </div>
            </div>
            <div className="text-xs text-[var(--text-sec)] mono bg-[var(--bg-alt)] p-2 rounded">
              HNSW: M={idx.hnswConfig.M} · efConstruction={idx.hnswConfig.efConstruction} · efSearch={idx.hnswConfig.efSearch}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleBulkUpload} className="card p-5" data-testid="bulk-upload-form">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 className="text-base font-semibold m-0 flex items-center gap-2">
            <Upload size={16} color="var(--accent)" /> {isRu ? 'Пакетная загрузка документов (JSON / Векторный батч)' : 'Bulk Document Ingestion (JSON / Vector Batch)'}
          </h3>
          <select className="input w-[200px]" value={selectedIndexForUpload} onChange={(e) => setSelectedIndexForUpload(e.target.value)}>
            {indexes.map((i) => <option key={i.name} value={i.name}>{isRu ? 'Индекс' : 'Target'}: {i.name}</option>)}
          </select>
        </div>
        <textarea className="input mono text-xs w-full h-24 mb-3" value={bulkJsonPayload} onChange={(e) => setBulkJsonPayload(e.target.value)} />
        <button type="submit" className="btn btn-primary btn-sm" data-testid="bulk-upload-submit">
          <Upload size={14} /> {isRu ? 'Загрузить и векторизовать документы' : 'Upload & Auto-Embed Documents'}
        </button>
      </form>
    </div>
  );
};
