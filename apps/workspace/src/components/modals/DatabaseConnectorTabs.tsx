import React, { useState } from 'react';
import { Upload, CheckCircle2, AlertTriangle, Code, Copy, Check, Database, ArrowRightLeft } from 'lucide-react';

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
        Paste array of items (RU / EN / JA / ZH) or upload a `.json` file — items are indexed in 384-d HNSW & synced to `/v1/catalog/upsert`:
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

type ConnectorSource = 'bitrix' | 'postgres' | 'mongodb' | 'algolia' | 'pinecone';

const CONNECTOR_SNIPPETS: Record<ConnectorSource, { title: string; subtitle: string; code: string }> = {
  bitrix: {
    title: '1С-Битрикс: Управление сайтом → EIDOS v3.2 (Модуль eidos.connector)',
    subtitle: 'Вставьте URL вашего сервера EIDOS и API-ключ в админке Битрикс (Настройки → Модули → EIDOS) или вызовите PHP API:',
    code: `<?php
// Вариант А: В админ-панели 1С-Битрикс (Настройки -> Настройки модулей -> EIDOS):
//   URL сервера EIDOS: http://localhost:3000  (или ваш production HTTPS домен)
//   API-ключ EIDOS:    eidos_dev_key          (или ваш EIDOS_API_KEY из .env)
//   Нажмите «Проверить связь» и «Синхронизировать сейчас»!

// Вариант Б: Программный вызов коннектора из init.php / крона 1С-Битрикс:
require_once $_SERVER['DOCUMENT_ROOT'] . '/bitrix/modules/eidos.connector/include.php';

use Eidos\\Connectors\\Bitrix\\Connector;
use Eidos\\Connectors\\Bitrix\\HttpClient;

$client = new HttpClient('http://localhost:3000', 'eidos_dev_key', 3.0, 1, false);
$connector = new Connector($client);

// 1. Проверка связи с сервером EIDOS (GET /v1/health)
$health = $connector->healthCheck(); // ['ok' => true, 'itemsIndexed' => 40, 'version' => '3.2.0']

// 2. Полная или дельта-синхронизация инфоблока каталога (POST /v1/catalog/upsert)
$sync = $connector->syncCatalog(['batchSize' => 100]);

// 3. Гибридный поиск с подменой стандартной выдачи Битрикса (POST /v1/search + fallback)
$items = $connector->replaceSearch('беспроводные наушники с шумоподавлением', ['limit' => 20]);`,
  },
  postgres: {
    title: 'PostgreSQL → EIDOS Real-Time & Batch Sync',
    subtitle: 'Streams rows from PostgreSQL and auto-vectorizes into 384-d HNSW index via @eidos/sdk',
    code: `import { Pool } from 'pg';
import { EidosClient } from '@eidos/sdk';

const pg = new Pool({ connectionString: process.env.DATABASE_URL });
const eidos = new EidosClient({
  baseUrl: process.env.EIDOS_URL || 'http://localhost:3000',
  apiKey: process.env.EIDOS_API_KEY || 'eidos_dev_key',
});

export async function syncPostgresCatalog() {
  const { rows } = await pg.query(\`
    SELECT id::text, title, description, category, price::float, tags, in_stock
    FROM products WHERE updated_at > NOW() - INTERVAL '24 hours'
  \`);

  for (const row of rows) {
    await eidos.upsertItem({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      price: row.price,
      tags: row.tags || [],
      inStock: row.in_stock ?? true,
    });
  }
  console.log(\`Synced \${rows.length} PostgreSQL records into EIDOS HNSW\`);
}`,
  },
  mongodb: {
    title: 'MongoDB Change Streams → EIDOS Zero-Lag Sync',
    subtitle: 'Listens to insert/update events on MongoDB collection and updates EIDOS in <10ms',
    code: `import { MongoClient } from 'mongodb';
import { EidosClient } from '@eidos/sdk';

const mongo = new MongoClient(process.env.MONGO_URI!);
const eidos = new EidosClient({
  baseUrl: process.env.EIDOS_URL || 'http://localhost:3000',
  apiKey: process.env.EIDOS_API_KEY || 'eidos_dev_key',
});

export async function watchMongoCatalog() {
  await mongo.connect();
  const collection = mongo.db('commerce').collection('products');
  const changeStream = collection.watch([], { fullDocument: 'updateLookup' });

  for await (const change of changeStream) {
    if (change.operationType === 'insert' || change.operationType === 'update') {
      const doc = change.fullDocument;
      if (!doc) continue;
      await eidos.upsertItem({
        id: String(doc._id),
        title: doc.title,
        description: doc.description || '',
        category: doc.category || 'General',
        price: Number(doc.price || 0),
        tags: doc.tags || [],
      });
    }
  }
}`,
  },
  algolia: {
    title: '15-Minute Migration from Algolia (algoliasearch → @eidos/sdk)',
    subtitle: 'Drop-in replacement for saveObjects() and index.search() with Hybrid HNSW + BM25 + MMR',
    code: `import algoliasearch from 'algoliasearch';
import { EidosClient } from '@eidos/sdk';

const algolia = algoliasearch(process.env.ALGOLIA_APP_ID!, process.env.ALGOLIA_ADMIN_KEY!);
const index = algolia.initIndex('products');
const eidos = new EidosClient({
  baseUrl: process.env.EIDOS_URL || 'http://localhost:3000',
  apiKey: process.env.EIDOS_API_KEY || 'eidos_dev_key',
});

// 1. Export all records from Algolia & ingest into EIDOS (384-d vectors computed automatically)
await index.browseObjects({
  batch: async (hits) => {
    for (const hit of hits as Array<Record<string, any>>) {
      await eidos.upsertItem({
        id: String(hit.objectID),
        title: String(hit.title || hit.name),
        description: String(hit.description || ''),
        category: String(hit.category || 'General'),
        price: Number(hit.price || 0),
        tags: Array.isArray(hit.tags) ? hit.tags : [],
      });
    }
  },
});

// 2. Replace index.search() with EIDOS Hybrid Search + Explainable X-Ray
const { results, latencyMs } = await eidos.search({
  query: 'wireless noise cancelling headphones',
  mode: 'hybrid',
  alpha: 0.65,
  limit: 10,
});`,
  },
  pinecone: {
    title: '15-Minute Migration from Pinecone / Meilisearch → EIDOS Unified API',
    subtitle: 'Eliminates external OpenAI embedding bills and combines Dense HNSW + Sparse BM25 + Business Reranking',
    code: `import { EidosClient } from '@eidos/sdk';

const eidos = new EidosClient({
  baseUrl: process.env.EIDOS_URL || 'http://localhost:3000',
  apiKey: process.env.EIDOS_API_KEY || 'eidos_dev_key',
});

// No external OpenAI/Cohere API call required — EIDOS computes 384-d embeddings natively
const response = await fetch('http://localhost:3000/v1/recommend', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.EIDOS_API_KEY || 'eidos_dev_key',
  },
  body: JSON.stringify({
    item_id: 'item-0',
    strategy: 'adaptive',       // LinUCB + Active Intent Learning + Submodular MMR
    diversity_factor: 0.35,     // Native MMR diversification
    limit: 8,
    filters: { category: 'Electronics', in_stock: true },
  }),
});
const { recommendations, latencyMs } = await response.json();`,
  },
};

export const DbSyncConnectorsTab: React.FC = () => {
  const [source, setSource] = useState<ConnectorSource>('bitrix');
  const [copied, setCopied] = useState(false);

  const active = CONNECTOR_SNIPPETS[source];

  const handleCopy = () => {
    void navigator.clipboard?.writeText(active.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: 'bitrix', label: '1С-Битрикс (eidos.connector)', icon: Database },
            { id: 'postgres', label: 'PostgreSQL Sync', icon: Database },
            { id: 'mongodb', label: 'MongoDB Change Streams', icon: Database },
            { id: 'algolia', label: 'Migrate from Algolia', icon: ArrowRightLeft },
            { id: 'pinecone', label: 'Migrate from Pinecone / Meili', icon: ArrowRightLeft },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSource(item.id)}
              className={source === item.id ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
            >
              <Icon size={12} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-alt)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)]">
          <div>
            <div className="text-xs font-bold text-[var(--text)]">{active.title}</div>
            <div className="text-[11px] text-[var(--text-sec)]">{active.subtitle}</div>
          </div>
          <button type="button" onClick={handleCopy} className="btn btn-secondary btn-sm">
            {copied ? <Check size={12} /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy Connector'}</span>
          </button>
        </div>
        <pre className="p-4 text-xs mono overflow-x-auto max-h-[320px] text-[var(--text)] m-0">
          {active.code}
        </pre>
      </div>
    </div>
  );
};
