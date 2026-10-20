import React, { useState } from 'react';
import {
  Database,
  Globe,
  Check,
  Copy,
  X,
  Upload,
  Sparkles,
  Server,
  Code2,
  Layers,
} from 'lucide-react';
import { SecurityGuardrails } from '@eidos/core';
import { CatalogItem } from '../types';
import {
  PLATFORM_DOMAIN_PRESETS,
  PlatformDomainId,
  PlatformDomainPreset,
} from '../data/domainDatabases';
import { detectTextLanguage } from '../utils/recommenderEngine';

interface DatabaseConnectorModalProps {
  isOpen: boolean;
  activeDomain: PlatformDomainId;
  catalogCount: number;
  onClose: () => void;
  onSelectDomainPreset: (preset: PlatformDomainPreset) => void;
  onImportCustomDatabase: (items: CatalogItem[], domainLabel?: string) => void;
}

type ConnectorTab = 'presets' | 'db_sync' | 'custom_json';
type DbEngineType = 'postgres' | 'mongodb' | 'mysql' | 'webhook';

export const DatabaseConnectorModal: React.FC<DatabaseConnectorModalProps> = ({
  isOpen,
  activeDomain,
  catalogCount,
  onClose,
  onSelectDomainPreset,
  onImportCustomDatabase,
}) => {
  const [tab, setTab] = useState<ConnectorTab>('presets');
  const [dbType, setDbType] = useState<DbEngineType>('postgres');
  const [copied, setCopied] = useState(false);
  const [rawJson, setRawJson] = useState<string>(() =>
    JSON.stringify(
      [
        {
          id: 'vid_jp_101',
          title: '【4K東京夜景】サイバーパンク都市のドローン空撮とシンセウェイヴ音楽',
          description: 'ネオン輝く東京の夜景を4K高画質で空撮した映像と、作業用BGMに最適な未来派エレクトロニック音楽。',
          category: '映像・音楽 (JP)',
          price: '52万回視聴 · 4K',
          icon: '🌃',
          tags: ['サイバーパンク', '音楽', '作業用bgm', '東京', '4k'],
        },
        {
          id: 'vid_jp_102',
          title: '【宇宙科学】ジェイムズ・ウェッブ宇宙望遠鏡が捉えた初期銀河とブラックホール',
          description: '最新の天文学データから紐解く宇宙誕生の謎、超巨大ブラックホールと相対性理論のドキュメンタリー。',
          category: '科学・宇宙 (JP)',
          price: '89万回視聴 · 34:10',
          icon: '🔭',
          tags: ['宇宙', 'ブラックホール', '科学', 'ドキュメンタリー'],
        },
      ],
      null,
      2
    )
  );
  const [jsonError, setJsonError] = useState<string | null>(null);

  if (!isOpen) return null;

  const getDbSyncCode = (engine: DbEngineType): string => {
    if (engine === 'postgres') {
      return `// PostgreSQL / Supabase -> Eidos Real-Time Vector Sync (Node.js / TypeScript)
import { Pool } from 'pg';
import { EidosClient } from '@eidos/sdk';

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const eidos = new EidosClient({
  baseUrl: process.env.EIDOS_API_URL || 'http://localhost:8080',
  apiKey: process.env.EIDOS_API_KEY,
});

// Sync Marketplace / Streaming / Video Hosting catalog (any language: RU, EN, JA, ZH...)
export async function syncDatabaseToEidos() {
  const { rows } = await db.query(\`
    SELECT id::text, title, description, category, tags, price_label AS price
    FROM catalog_items WHERE is_published = true LIMIT 500
  \`);

  // Eidos automatically vectorizes 100+ languages (including Japanese/CJK) to 384-d HNSW
  const res = await fetch(\`\${eidos.baseUrl}/v1/catalog\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.EIDOS_API_KEY! },
    body: JSON.stringify({ items: rows }),
  });
  console.log('Synced to Eidos HNSW Index:', await res.json());
}`;
    }
    if (engine === 'mongodb') {
      return `// MongoDB Atlas / DocumentDB -> Eidos Vector Ingestion
import { MongoClient } from 'mongodb';

const mongo = new MongoClient(process.env.MONGO_URI!);

export async function syncMongoVideosToEidos() {
  await mongo.connect();
  const videos = await mongo.db('video_platform').collection('videos').find({}).limit(500).toArray();

  const payload = {
    items: videos.map((v) => ({
      id: String(v._id),
      title: v.title,               // Works in Japanese (日本語), English, Russian, Chinese, etc.
      description: v.description,
      category: v.channelCategory || 'Video',
      tags: v.tags || [],
    })),
  };

  await fetch('http://localhost:8080/v1/catalog', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.EIDOS_API_KEY! },
    body: JSON.stringify(payload),
  });
}`;
    }
    if (engine === 'mysql') {
      return `# Python SQLAlchemy / MySQL -> Eidos SDK Sync (Marketplaces & Video Platforms)
import pymysql
import requests

conn = pymysql.connect(host="localhost", user="root", password="secret", database="marketplace")
with conn.cursor(pymysql.cursors.DictCursor) as cursor:
    cursor.execute("SELECT id, title, description, category FROM products WHERE active = 1 LIMIT 500")
    items = [
        {
            "id": str(row["id"]),
            "title": row["title"],
            "description": row["description"],
            "category": row["category"],
            "tags": []
        }
        for row in cursor.fetchall()
    ]

# Batch index into Eidos 384-d HNSW + Multilingual CJK BM25
resp = requests.post(
    "http://localhost:8080/v1/catalog",
    headers={"x-api-key": "your-production-api-key"},
    json={"items": items}
)
print("Indexed:", resp.json())`;
    }
    return `# Universal REST Webhook (Any CMS, Shopify, Custom Video Hosting, Strapi)
curl -X POST http://localhost:8080/v1/catalog \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: your-production-api-key" \\
  -d '{
    "items": [
      {
        "id": "video_jp_01",
        "title": "【4K科学】宇宙とブラックホールの事象の地平線",
        "description": "相対性理論と宇宙物理学を解説するドキュメンタリー動画",
        "category": "科学・宇宙",
        "tags": ["宇宙", "ブラックホール", "科学"]
      }
    ]
  }'`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getDbSyncCode(dbType));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImportCustomJson = () => {
    setJsonError(null);
    try {
      const parsed = JSON.parse(rawJson);
      const arr = Array.isArray(parsed) ? parsed : parsed.items;
      if (!Array.isArray(arr) || arr.length === 0) {
        setJsonError('JSON должен содержать непустой массив объектов (или поле "items").');
        return;
      }
      const normalized: CatalogItem[] = arr.map((item: any, idx: number) => {
        const rawTitle = String(item.title || item.name || `Item #${idx + 1}`);
        const rawDesc = String(item.description || item.notes || rawTitle);
        const rawCat = String(item.category || 'Custom');
        const title = SecurityGuardrails.scanAndSanitize(rawTitle).sanitizedInput || `Item #${idx + 1}`;
        const description = SecurityGuardrails.scanAndSanitize(rawDesc).sanitizedInput || title;
        const category = SecurityGuardrails.scanAndSanitize(rawCat).sanitizedInput || 'Custom';
        const detectedLang = detectTextLanguage(`${title} ${description}`);
        return {
          id: String(item.id || `custom_${Date.now()}_${idx}`),
          title,
          description,
          category,
          price: item.price
            ? SecurityGuardrails.scanAndSanitize(String(item.price)).sanitizedInput
            : item.views
            ? SecurityGuardrails.scanAndSanitize(String(item.views)).sanitizedInput
            : '—',
          rating: Number(item.rating) || 4.9,
          reviews: Number(item.reviews) || 100,
          badge: `Lang: ${detectedLang.toUpperCase()}`,
          icon: item.icon || '🎬',
          tags: Array.isArray(item.tags)
            ? item.tags.map((t: any) => SecurityGuardrails.scanAndSanitize(String(t)).sanitizedInput)
            : [],
          custom: true,
        };
      });
      onImportCustomDatabase(normalized, 'Custom Database');
      onClose();
    } catch (e: any) {
      setJsonError(`Ошибка парсинга JSON: ${e?.message || 'Проверьте синтаксис'}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = String(ev.target?.result || '');
      if (content) {
        setRawJson(content);
        setJsonError(null);
      }
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 900,
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border)',
            paddingBottom: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Database size={20} color="var(--accent)" />
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.0625rem', color: 'var(--text)' }}>
                Подключение базы данных и выбор индустрии (100+ языков)
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)' }}>
                Маркетплейсы, Стриминговые площадки и Видеохостинги (RU · EN · 日本語 · 中文 · ES · DE) · Активно: {catalogCount} SKU
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
            <X size={15} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
          <button
            type="button"
            onClick={() => setTab('presets')}
            className={tab === 'presets' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
          >
            <Globe size={14} />
            <span>1. Готовые базы площадок (Маркетплейс / Стриминг / Видеохостинг JP)</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('db_sync')}
            className={tab === 'db_sync' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
          >
            <Server size={14} />
            <span>2. Коннектор вашей СУБД (PostgreSQL / MongoDB / MySQL / Webhook)</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('custom_json')}
            className={tab === 'custom_json' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
          >
            <Upload size={14} />
            <span>3. Загрузить свою базу JSON (Любой язык)</span>
          </button>
        </div>

        {/* TAB 1: READY DOMAIN PRESETS */}
        {tab === 'presets' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: 'var(--bg-alt)',
                border: '1px solid var(--border)',
                fontSize: '0.8125rem',
                color: 'var(--text-sec)',
              }}
            >
              Выберите тип площадки ниже, чтобы мгновенно подключить соответствующую базу данных, перестроить 384-мерный индекс HNSW + CJK BM25 и протестировать рекомендации на языке площадки (включая японский видеохостинг <strong>日本語</strong>):
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 14 }}>
              {PLATFORM_DOMAIN_PRESETS.map((preset) => {
                const isSelected = activeDomain === preset.id;
                return (
                  <div
                    key={preset.id}
                    data-testid={`domain-preset-${preset.id}`}
                    onClick={() => {
                      onSelectDomainPreset(preset);
                      onClose();
                    }}
                    className="card"
                    style={{
                      padding: 18,
                      cursor: 'pointer',
                      border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                      background: isSelected ? 'var(--bg-alt)' : 'var(--surface)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '1.5rem' }}>{preset.icon}</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text)' }}>
                              {preset.name}
                            </div>
                            <div className="mono" style={{ fontSize: '0.6875rem', color: 'var(--accent)', marginTop: 2 }}>
                              Язык: {preset.languageLabel} · {preset.items.length} объектов
                            </div>
                          </div>
                        </div>
                        <span className="badge badge-accent">{preset.badge}</span>
                      </div>

                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-sec)', marginTop: 10, lineHeight: 1.5 }}>
                        {preset.description}
                      </p>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                      <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-mut)' }}>
                        Пример: «{preset.items[0]?.title.slice(0, 28)}...»
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isSelected ? 'var(--success)' : 'var(--accent)' }}>
                        {isSelected ? '✓ Активна' : 'Подключить базу →'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: PRODUCTION DATABASE CONNECTOR */}
        {tab === 'db_sync' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { id: 'postgres' as DbEngineType, label: 'PostgreSQL / Supabase' },
                  { id: 'mongodb' as DbEngineType, label: 'MongoDB / DocumentDB' },
                  { id: 'mysql' as DbEngineType, label: 'MySQL / Python' },
                  { id: 'webhook' as DbEngineType, label: 'REST Webhook (cURL)' },
                ].map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setDbType(b.id)}
                    className={dbType === b.id ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                  >
                    <Code2 size={13} />
                    <span>{b.label}</span>
                  </button>
                ))}
              </div>

              <button type="button" onClick={handleCopy} className="btn btn-secondary btn-sm">
                {copied ? <Check size={13} /> : <Copy size={13} />}
                <span>{copied ? 'Код скопирован' : 'Скопировать коннектор'}</span>
              </button>
            </div>

            <pre
              className="mono"
              style={{
                padding: 16,
                background: '#0B0F19',
                color: '#E2E8F0',
                borderRadius: 8,
                fontSize: '0.75rem',
                overflowX: 'auto',
                lineHeight: 1.55,
                margin: 0,
              }}
            >
              <code>{getDbSyncCode(dbType)}</code>
            </pre>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 12,
                padding: 14,
                background: 'var(--bg-alt)',
                borderRadius: 8,
                border: '1px solid var(--border)',
                fontSize: '0.75rem',
              }}
            >
              <div>
                <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 4 }}>
                  1. Zero Cold-Start (0мс старт)
                </strong>
                <span style={{ color: 'var(--text-sec)' }}>
                  Любой новый товар, фильм или видеоролик сразу после загрузки получает 384-d вектор и попадает в выдачу без ожидания кликов.
                </span>
              </div>
              <div>
                <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 4 }}>
                  2. Поддержка всех языков (CJK + RTL + EU)
                </strong>
                <span style={{ color: 'var(--text-sec)' }}>
                  Автоматическая токенизация японских кандзи/каны, китайского, корейского, русского и европейских языков.
                </span>
              </div>
              <div>
                <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 4 }}>
                  3. Готовый ответ с объяснением
                </strong>
                <span style={{ color: 'var(--text-sec)' }}>
                  API возвращает отранжированный список + объяснение рекомендации на родном языке контента.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CUSTOM JSON UPLOAD IN ANY LANGUAGE */}
        {tab === 'custom_json' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-sec)' }}>
                Вставьте JSON массив ваших товаров, фильмов или видеороликов на <strong>любом языке мира</strong> (например, на японском, английском, русском) или загрузите файл <code>.json</code>:
              </span>
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                <Upload size={13} />
                <span>Загрузить .json файл</span>
                <input type="file" accept=".json,application/json" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
            </div>

            <textarea
              className="input mono"
              rows={10}
              value={rawJson}
              onChange={(e) => setRawJson(e.target.value)}
              style={{ fontSize: '0.75rem', lineHeight: 1.5, fontFamily: 'var(--font-mono)' }}
            />

            {jsonError && (
              <div style={{ color: 'var(--danger, #ef4444)', fontSize: '0.75rem', fontWeight: 600 }}>
                {jsonError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
                Отмена
              </button>
              <button type="button" onClick={handleImportCustomJson} className="btn btn-primary btn-sm">
                <Sparkles size={14} />
                <span>Подключить базу и рассчитать 384-d векторы</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
