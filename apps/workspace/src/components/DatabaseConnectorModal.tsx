import React, { useState } from "react";
import { X, Globe, Database, CheckCircle2, FileJson } from 'lucide-react';
import { SecurityGuardrails } from '@eidos/core';
import { CatalogItem } from '../types';
import {
  PLATFORM_DOMAIN_PRESETS,
  PlatformDomainId,
  PlatformDomainPreset,
} from '../data/domainDatabases';
import { CustomJsonConnectorTab } from './modals/DatabaseConnectorTabs';

interface DatabaseConnectorModalProps {
  isOpen: boolean;
  activeDomain: PlatformDomainId;
  catalogCount: number;
  onClose: () => void;
  onSelectDomainPreset: (preset: PlatformDomainPreset) => void;
  onImportCustomDatabase: (items: CatalogItem[], label?: string) => void;
}

const SAMPLE_CUSTOM_JSON = JSON.stringify(
  [
    {
      id: 'custom_1',
      title: 'Sony Alpha A7R V Mirrorless Camera',
      category: 'Cameras & Optics',
      description: '61MP full-frame sensor with AI autofocus and 8K video recording',
      price: '$3,899',
      rating: 4.9,
      icon: '📷',
      tags: ['camera', '8k', 'photography'],
    },
    {
      id: 'custom_2',
      title: '京都 宇治抹茶 エスプレッソマシン Pro',
      category: 'キッチン家電',
      description: '伝統的な石臼挽き抹茶とエスプレッソのハイブリッド抽出システム',
      price: '¥64,800',
      rating: 4.8,
      icon: '🍵',
      tags: ['抹茶', 'カフェ', '京都'],
    },
  ],
  null,
  2
);

export const DatabaseConnectorModal: React.FC<DatabaseConnectorModalProps> = ({
  isOpen,
  activeDomain,
  catalogCount,
  onClose,
  onSelectDomainPreset,
  onImportCustomDatabase,
}) => {
  const [tab, setTab] = useState<'presets' | 'json'>('presets');
  const [jsonInput, setJsonInput] = useState(SAMPLE_CUSTOM_JSON);
  const [jsonError, setJsonError] = useState<string | null>(null);

  if (!isOpen) return null;

  const parseAndImportJson = (rawText: string, sourceLabel = 'Custom JSON DB') => {
    setJsonError(null);
    try {
      const parsed = JSON.parse(rawText);
      const arr = Array.isArray(parsed) ? parsed : parsed.items || parsed.data || [];
      if (!Array.isArray(arr) || arr.length === 0) {
        setJsonError('JSON must contain a non-empty array of catalog items.');
        return;
      }

      const normalized: CatalogItem[] = arr.map((row: Record<string, unknown>, idx: number) => {
        const rawTitle = String(row.title || row.name || `Item #${idx + 1}`);
        const rawCat = String(row.category || row.genre || 'General');
        const rawDesc = String(row.description || row.notes || rawTitle);

        const safeTitle = SecurityGuardrails.scanAndSanitize(rawTitle).sanitizedInput || rawTitle;
        const safeCat = SecurityGuardrails.scanAndSanitize(rawCat).sanitizedInput || rawCat;
        const safeDesc = SecurityGuardrails.scanAndSanitize(rawDesc).sanitizedInput || rawDesc;

        return {
          id: String(row.id ?? `db_${Date.now()}_${idx}`),
          title: safeTitle,
          category: safeCat,
          description: safeDesc,
          price: row.price !== undefined ? String(row.price) : '—',
          rating: typeof row.rating === 'number' ? row.rating : 4.8,
          reviews: typeof row.reviews === 'number' ? row.reviews : 42,
          icon: typeof row.icon === 'string' ? row.icon : '📦',
          tags: Array.isArray(row.tags) ? row.tags.map(String) : [safeCat.toLowerCase()],
          custom: true,
        };
      });

      onImportCustomDatabase(normalized, sourceLabel);
      onClose();
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Invalid JSON syntax');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      setJsonInput(content);
      parseAndImportJson(content, file.name);
    };
    reader.readAsText(file);
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
            <Globe size={18} className="text-[var(--accent)]" />
            <div>
              <div className="font-bold text-base text-[var(--text)]">
                Platform Domain & Browser-First Catalog Connector
              </div>
              <div className="text-xs text-[var(--text-sec)]">
                Active Index: {catalogCount.toLocaleString()} items in IndexedDB + 384-d HNSW
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('presets')}
              className={tab === 'presets' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
            >
              <Database size={13} />
              <span>Industry Presets</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('json')}
              className={tab === 'json' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
            >
              <FileJson size={13} />
              <span>Import JSON</span>
            </button>
            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {tab === 'presets' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {PLATFORM_DOMAIN_PRESETS.map((preset) => {
                const isSelected = activeDomain === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => {
                      onSelectDomainPreset(preset);
                      onClose();
                    }}
                    className={`card p-4 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[1.5px] border-[var(--accent)] bg-[var(--accent-bg)]'
                        : 'hover:border-[var(--accent)]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg font-bold text-[var(--text)]">
                        {preset.icon} {preset.name}
                      </span>
                      {isSelected && <CheckCircle2 size={16} className="text-[var(--accent)]" />}
                    </div>
                    <p className="text-xs text-[var(--text-sec)] mb-3">{preset.description}</p>
                    <div className="flex items-center justify-between text-xs mono text-[var(--text-mut)]">
                      <span>{preset.languageLabel}</span>
                      <span>{preset.items.length} curated SKUs</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <CustomJsonConnectorTab
              jsonInput={jsonInput}
              jsonError={jsonError}
              onChangeJson={setJsonInput}
              onLoadSample={() => setJsonInput(SAMPLE_CUSTOM_JSON)}
              onFileUpload={handleFileUpload}
              onApplyJson={() => parseAndImportJson(jsonInput)}
            />
          )}
        </div>
      </div>
    </div>
  );
};
export default DatabaseConnectorModal;
