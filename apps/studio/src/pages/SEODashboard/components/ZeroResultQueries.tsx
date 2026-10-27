import React, { useState } from 'react';
import {
  AlertTriangle,
  PlusCircle,
  Zap,
  Check,
  X,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { ZeroResultQueryItem, TopClickedProductItem } from '../types';

export interface ZeroResultQueriesProps {
  id?: string;
  zeroQueries: ZeroResultQueryItem[];
  availableProducts: TopClickedProductItem[];
  activeSynonyms?: Record<string, string>;
  onAddSynonym: (query: string, synonym: string, targetItemId?: string) => Promise<void>;
  onBoostProduct: (itemId: string, boostWeight: number, query: string) => Promise<void>;
  onInspectQuery: (query: string) => void;
}

export const ZeroResultQueries: React.FC<ZeroResultQueriesProps> = ({
  id,
  zeroQueries,
  availableProducts,
  activeSynonyms = {},
  onAddSynonym,
  onBoostProduct,
  onInspectQuery,
}) => {
  const [editingSynonymFor, setEditingSynonymFor] = useState<string | null>(null);
  const [synonymInput, setSynonymInput] = useState<string>('');
  const [boostingForQuery, setBoostingForQuery] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>(
    availableProducts[0]?.id || 'prod_1'
  );
  const [boostWeight, setBoostWeight] = useState<number>(0.35);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const openSynonymEditor = (item: ZeroResultQueryItem) => {
    setBoostingForQuery(null);
    setEditingSynonymFor(item.query);
    setSynonymInput(item.suggestedSynonym || 'кроссовки nike');
  };

  const openBoostEditor = (item: ZeroResultQueryItem) => {
    setEditingSynonymFor(null);
    setBoostingForQuery(item.query);
    if (availableProducts.length > 0) {
      setSelectedProductId(availableProducts[0].id);
    }
  };

  const handleConfirmSynonym = async (query: string) => {
    if (!synonymInput.trim()) return;
    setSubmitting(true);
    try {
      await onAddSynonym(query, synonymInput.trim(), availableProducts[0]?.id);
      setEditingSynonymFor(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmBoost = async (query: string) => {
    if (!selectedProductId) return;
    setSubmitting(true);
    try {
      await onBoostProduct(selectedProductId, boostWeight, query);
      setBoostingForQuery(null);
    } finally {
      setSubmitting(false);
    }
  };

  const activeSynonymEntries = Object.entries(activeSynonyms);

  return (
    <div
      id={id}
      className="rounded-lg bg-[#1e293b] border border-slate-700/80 p-4 flex flex-col justify-between"
    >
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-700/80">
          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-[#ef4444]" />
              <h2 className="text-sm font-semibold text-[#f1f5f9] uppercase tracking-wider">
                Top Zero-Result Queries
              </h2>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono tabular-nums font-semibold bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/40">
                {zeroQueries.length} упущенных
              </span>
            </div>
            <p className="text-[12px] text-slate-400 mt-0.5">
              Запросы с 0 результатами — добавьте синоним или привяжите буст товара в 1 клик
            </p>
          </div>
        </div>

        {/* List of Zero-Result Queries */}
        <div className="divide-y divide-slate-800 mt-2">
          {zeroQueries.length === 0 ? (
            <div className="py-6 text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-[#22c55e]/15 text-[#22c55e] text-[12px] font-medium">
                <Check size={14} />
                Все критические Zero-Result запросы закрыты синонимами!
              </div>
            </div>
          ) : (
            zeroQueries.map((item) => {
              const isEditingSyn = editingSynonymFor === item.query;
              const isBoosting = boostingForQuery === item.query;

              return (
                <div key={item.query} className="py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => onInspectQuery(item.query)}
                        className="text-[13px] font-semibold text-[#f1f5f9] hover:text-[#3b82f6] transition-colors cursor-pointer"
                        title="Проверить запрос в X-Ray"
                      >
                        «{item.query}»
                      </button>
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono tabular-nums bg-[#ef4444]/15 text-[#ef4444] font-semibold">
                        {item.volume} поисков
                      </span>
                      {item.suggestedSynonym && (
                        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400">
                          <Sparkles size={11} className="text-[#3b82f6]" />
                          рек.: <span className="text-slate-300">{item.suggestedSynonym}</span>
                        </span>
                      )}
                    </div>

                    {/* Actionable CTA Buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openSynonymEditor(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-[#3b82f6]/20 text-[#3b82f6] hover:bg-[#3b82f6]/30 border border-[#3b82f6]/40 transition-colors cursor-pointer"
                      >
                        <PlusCircle size={12} />
                        <span>Add Synonym</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openBoostEditor(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-[#22c55e]/15 text-[#22c55e] hover:bg-[#22c55e]/25 border border-[#22c55e]/40 transition-colors cursor-pointer"
                      >
                        <Zap size={12} />
                        <span>Boost Product</span>
                      </button>
                    </div>
                  </div>

                  {/* Inline Action Drawer: Add Synonym */}
                  {isEditingSyn && (
                    <div className="mt-2 p-2.5 rounded bg-[#0f172a] border border-[#3b82f6]/50 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-400">
                        Синоним для «{item.query}»:
                      </span>
                      <ArrowRight size={12} className="text-[#3b82f6]" />
                      <input
                        type="text"
                        value={synonymInput}
                        onChange={(e) => setSynonymInput(e.target.value)}
                        placeholder="Напр.: adidas кроссовки"
                        className="flex-1 min-w-[160px] px-2.5 py-1 rounded bg-[#1e293b] border border-slate-700 text-[12px] text-[#f1f5f9] focus:outline-none focus:border-[#3b82f6]"
                      />
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => void handleConfirmSynonym(item.query)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#22c55e] text-slate-950 font-semibold text-[11px] hover:bg-[#22c55e]/90 cursor-pointer"
                      >
                        <Check size={12} />
                        <span>Применить в EIDOS</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingSynonymFor(null)}
                        className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
                        aria-label="Close"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  )}

                  {/* Inline Action Drawer: Boost Product */}
                  {isBoosting && (
                    <div className="mt-2 p-2.5 rounded bg-[#0f172a] border border-[#22c55e]/50 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-400">
                        Буст товара для «{item.query}»:
                      </span>
                      <select
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value)}
                        className="flex-1 min-w-[180px] px-2 py-1 rounded bg-[#1e293b] border border-slate-700 text-[12px] text-[#f1f5f9] focus:outline-none focus:border-[#22c55e]"
                      >
                        {availableProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            [{p.id}] {p.title}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center gap-1 text-[11px] font-mono text-slate-300">
                        <span>Boost:</span>
                        <input
                          type="number"
                          step="0.05"
                          min="0.1"
                          max="2.0"
                          value={boostWeight}
                          onChange={(e) => setBoostWeight(Number(e.target.value) || 0.35)}
                          className="w-14 px-1.5 py-1 rounded bg-[#1e293b] border border-slate-700 text-right font-mono text-[11px] text-[#22c55e]"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => void handleConfirmBoost(item.query)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#22c55e] text-slate-950 font-semibold text-[11px] hover:bg-[#22c55e]/90 cursor-pointer"
                      >
                        <Zap size={12} />
                        <span>Boost в Топ-1</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setBoostingForQuery(null)}
                        className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
                        aria-label="Close"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Active Synonyms Footer */}
      {activeSynonymEntries.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-slate-700/70">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Активные синонимы EIDOS ({activeSynonymEntries.length}):
          </div>
          <div className="flex flex-wrap gap-1.5">
            {activeSynonymEntries.map(([q, syn]) => (
              <span
                key={q}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/30"
              >
                <span>{q}</span>
                <ArrowRight size={10} />
                <span>{syn}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
