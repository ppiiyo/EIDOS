import React from 'react';
import { Database, FileSpreadsheet, Terminal, RotateCcw, Globe, Cpu } from 'lucide-react';
import { CatalogItem } from '../types';
import { UiLanguage, UI_TRANSLATIONS } from '../i18n/uiTranslations';
import { EmbeddingEngineState } from '../lib/embeddings';

interface StudioHeaderProps {
  catalogCount: number;
  selectedItem: CatalogItem | null;
  uiLang: UiLanguage;
  isScaledCatalog: boolean;
  engineState: EmbeddingEngineState;
  onChangeLang: (lang: UiLanguage) => void;
  onOpenDbConnector: () => void;
  onScaleCatalog: () => void;
  onRestoreCatalog: () => void;
  onOpenCsvModal: () => void;
  onOpenApiModal: () => void;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  catalogCount,
  selectedItem,
  uiLang,
  isScaledCatalog,
  engineState,
  onChangeLang,
  onOpenDbConnector,
  onScaleCatalog,
  onRestoreCatalog,
  onOpenCsvModal,
  onOpenApiModal,
}) => {
  const tTop = UI_TRANSLATIONS[uiLang].topbar;

  const statusBadge = (() => {
    if (engineState.status === 'ready') {
      return {
        label: 'ONNX 384-d Neural Ready',
        color: 'text-[var(--success)] border-[var(--success)]/40 bg-[var(--success)]/10',
      };
    }
    if (engineState.status === 'loading-model') {
      return {
        label: `ONNX Loading (${engineState.progress}%) · BM25 Mode`,
        color: 'text-[var(--warning)] border-[var(--warning)]/40 bg-[var(--warning)]/10',
      };
    }
    return {
      label: 'BM25 Lexical + 384-d Index Ready',
      color: 'text-[var(--accent)] border-[var(--border)] bg-[var(--bg-alt)]',
    };
  })();

  return (
    <header className="h-[52px] border-b border-[var(--border)] bg-[var(--surface)] px-6 flex items-center justify-between gap-3 sticky top-0 z-10">
      <div className="flex items-center gap-3 min-w-0">
        <span className="mono text-xs px-2 py-0.5 rounded bg-[var(--bg-alt)] border border-[var(--border)] text-[var(--text-sec)] whitespace-nowrap">
          {catalogCount.toLocaleString()} SKU · 384-d
        </span>

        <span
          data-testid="embedding-engine-status"
          className={`mono text-[11px] px-2 py-0.5 rounded border flex items-center gap-1.5 whitespace-nowrap ${statusBadge.color}`}
        >
          <Cpu size={12} />
          <span>{statusBadge.label}</span>
        </span>

        {selectedItem && (
          <div className="text-[0.8125rem] text-[var(--text-sec)] whitespace-nowrap overflow-hidden text-ellipsis">
            {tTop.activeSeed}{' '}
            <strong className="text-[var(--text)]">
              {selectedItem.icon} {selectedItem.title}
            </strong>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div
          data-testid="ui-lang-switcher"
          className="inline-flex items-center bg-[var(--bg-alt)] border border-[var(--border)] rounded-md p-0.5 gap-0.5"
        >
          {(['ru', 'en', 'ja'] as UiLanguage[]).map((lang) => {
            const active = uiLang === lang;
            return (
              <button
                key={lang}
                type="button"
                data-testid={`ui-lang-${lang}`}
                onClick={() => onChangeLang(lang)}
                className={`border-0 rounded px-2 py-0.5 text-[0.6875rem] font-bold cursor-pointer transition-all ${
                  active
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-transparent text-[var(--text-sec)]'
                }`}
                title={UI_TRANSLATIONS[lang].languageName}
              >
                {lang.toUpperCase()}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onOpenDbConnector}
          className="btn btn-secondary btn-sm"
          title="Switch platform database or import custom JSON"
        >
          <Globe size={13} />
          <span>{tTop.connectDb}</span>
        </button>

        {isScaledCatalog ? (
          <button
            type="button"
            onClick={onRestoreCatalog}
            className="btn btn-secondary btn-sm"
            title={tTop.restoreCurated}
          >
            <RotateCcw size={13} />
            <span>{tTop.scaledBadge}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onScaleCatalog}
            className="btn btn-secondary btn-sm"
            title="Scale corpus to 1,200+ synthetic items with HNSW"
          >
            <Database size={13} />
            <span>{tTop.scaleTo1200}</span>
          </button>
        )}

        <button type="button" onClick={onOpenCsvModal} className="btn btn-secondary btn-sm">
          <FileSpreadsheet size={13} />
          <span>{tTop.csvModal}</span>
        </button>

        <button type="button" onClick={onOpenApiModal} className="btn btn-primary btn-sm">
          <Terminal size={13} />
          <span>{tTop.apiSdk}</span>
        </button>
      </div>
    </header>
  );
};
