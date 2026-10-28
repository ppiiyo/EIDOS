import React from 'react';
import { Sparkles, Plus, ArrowUpRight } from 'lucide-react';
import type { TopQueryItem, ZeroResultItem, TopProductItem } from './SEODashboard';

interface SeoTablesAndMerchandisingProps {
  topQueries: TopQueryItem[];
  zeroResultQueries: ZeroResultItem[];
  topClickedProducts: TopProductItem[];
  sourceTerm: string;
  targetSynonym: string;
  onChangeSourceTerm: (val: string) => void;
  onChangeTargetSynonym: (val: string) => void;
  onAddSynonym: (term: string, target: string) => void;
  onBoostProduct: (productId: string, title: string) => void;
  isRu: boolean;
}

export const SeoTablesAndMerchandising: React.FC<SeoTablesAndMerchandisingProps> = ({
  topQueries,
  zeroResultQueries,
  topClickedProducts,
  sourceTerm,
  targetSynonym,
  onChangeSourceTerm,
  onChangeTargetSynonym,
  onAddSynonym,
  onBoostProduct,
  isRu,
}) => {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="text-base font-bold text-[var(--text)] m-0 mb-3">
            {isRu ? 'Высокочастотные поисковые запросы' : 'High-Volume Search Queries'}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-sec)]">
                  <th className="py-2 pr-3">{isRu ? 'Запрос' : 'Query'}</th>
                  <th className="py-2 px-2">{isRu ? 'Частота' : 'Volume'}</th>
                  <th className="py-2 px-2">CTR</th>
                  <th className="py-2 pl-2 text-right">{isRu ? 'Выручка' : 'Revenue'}</th>
                </tr>
              </thead>
              <tbody>
                {topQueries.map((q) => (
                  <tr key={q.query} className="border-b border-[var(--border)]/50">
                    <td className="py-2.5 pr-3 font-semibold text-[var(--text)]">{q.query}</td>
                    <td className="py-2.5 px-2 mono">{q.volume}</td>
                    <td className="py-2.5 px-2 mono text-[var(--success)]">{q.ctr.toFixed(1)}%</td>
                    <td className="py-2.5 pl-2 mono text-right">${q.revenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-5 flex flex-col justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-[var(--text)] m-0 mb-1">
              {isRu
                ? 'Устранение пустой выдачи и словарь синонимов'
                : 'Zero-Result Query Recovery & Synonym Bridge'}
            </h2>
            <p className="text-xs text-[var(--text-sec)] m-0 mb-3">
              {isRu
                ? 'Свяжите опечатки и разговорные запросы с каноническими терминами каталога в 1 клик.'
                : 'Map misspelled or colloquial zero-result queries to canonical catalog terms.'}
            </p>

            <div className="flex flex-col gap-2">
              {zeroResultQueries.map((zq) => (
                <div
                  key={zq.query}
                  className="p-2.5 rounded border border-[var(--border)] bg-[var(--bg-alt)] flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <span className="font-bold text-[var(--text)]">"{zq.query}"</span>
                    <span className="mono text-[var(--text-sec)] ml-2">
                      ({zq.volume} {isRu ? 'запр.' : 'searches'})
                    </span>
                  </div>
                  {zq.resolvedSynonym ? (
                    <span className="mono text-[var(--success)] font-semibold">
                      → {zq.resolvedSynonym}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAddSynonym(zq.query, zq.suggestedSynonym || 'electronics')}
                      className="btn btn-secondary btn-sm"
                    >
                      <Sparkles size={12} />
                      <span>
                        {isRu ? 'Связать →' : 'Map →'} "{zq.suggestedSynonym || 'electronics'}"
                      </span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--border)] flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder={isRu ? 'Запрос с 0 результатов (напр. абибас)' : 'Zero-result term (e.g. абибас)'}
              value={sourceTerm}
              onChange={(e) => onChangeSourceTerm(e.target.value)}
              className="input text-xs flex-1 min-w-[140px]"
            />
            <input
              type="text"
              placeholder={isRu ? 'Канонический синоним (напр. adidas)' : 'Canonical target (e.g. adidas)'}
              value={targetSynonym}
              onChange={(e) => onChangeTargetSynonym(e.target.value)}
              className="input text-xs flex-1 min-w-[140px]"
            />
            <button
              type="button"
              onClick={() => onAddSynonym(sourceTerm, targetSynonym)}
              className="btn btn-primary btn-sm"
            >
              <Plus size={13} />
              <span>{isRu ? 'Добавить синоним' : 'Add Synonym'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-base font-bold text-[var(--text)] m-0 mb-3">
          {isRu
            ? 'Лидеры конверсии и бустинг товаров в 1 клик'
            : 'Top Converting SKUs & 1-Click Merchandising Boost'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {topClickedProducts.map((prod) => (
            <div
              key={prod.id}
              className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--bg-alt)] flex flex-col justify-between gap-3"
            >
              <div>
                <div className="font-bold text-sm text-[var(--text)]">{prod.title}</div>
                <div className="text-xs mono text-[var(--text-sec)] mt-1">
                  {isRu
                    ? `Клики: ${prod.clicks} · Покупки: ${prod.purchases} · CR: ${prod.conversionRate}%`
                    : `Clicks: ${prod.clicks} · Purchases: ${prod.purchases} · CR: ${prod.conversionRate}%`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onBoostProduct(prod.id, prod.title)}
                className="btn btn-secondary btn-sm w-full justify-center"
              >
                <ArrowUpRight size={13} />
                <span>{isRu ? 'Повысить в выдаче (1.35x)' : 'Boost Ranking (1.35x)'}</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};
