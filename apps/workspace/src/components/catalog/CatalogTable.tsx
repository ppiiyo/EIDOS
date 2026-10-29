import React from "react";
import { Boxes, Lightbulb, Trash2 } from 'lucide-react';
import { CatalogItem } from '../../types';
import { trackEvent } from '../../lib/analytics/tracker';

interface CatalogTableProps {
  items: CatalogItem[];
  embeddings: Map<string, Float32Array>;
  onSelectItem?: (item: CatalogItem) => void;
  onInspectIn3D?: (item: CatalogItem) => void;
  onDeleteItem: (id: string) => void;
}

export const CatalogTable: React.FC<CatalogTableProps> = ({
  items,
  embeddings,
  onSelectItem,
  onInspectIn3D,
  onDeleteItem,
}) => {
  return (
    <div className="card overflow-x-auto">
      <table className="table" data-testid="catalog-table">
        <thead>
          <tr>
            <th className="w-[72px]">ID</th>
            <th>Item Title & Category</th>
            <th className="w-[120px]">Price</th>
            <th>Semantic Description</th>
            <th className="w-[110px]">Vector Norm</th>
            <th className="w-[170px] text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={6} className="py-10 px-4 text-center text-xs text-[var(--text-sec)]">
                Каталог пуст (0 SKU). Загрузите свою базу данных (CSV / JSON) или добавьте товар вручную, либо откройте вкладку «Демо-каталог (48 SKU)».
              </td>
            </tr>
          )}
          {items.slice(0, 150).map((item) => {
            const vec = embeddings.get(String(item.id));
            return (
              <tr
                key={item.id}
                onClick={() => {
                  trackEvent({ type: 'item_click', itemId: item.id, category: item.category });
                  onSelectItem?.(item);
                }}
                className="cursor-pointer"
              >
                <td className="mono text-xs text-[var(--text-sec)]">#{item.id}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{item.icon || '📦'}</span>
                    <div>
                      <div className="font-semibold text-[var(--text)]">{item.title}</div>
                      <div className="text-xs text-[var(--text-sec)]">
                        <span>{item.category}</span>
                        {item.rating && (
                          <>
                            <span> · </span>
                            <span className="mono">★ {item.rating.toFixed(1)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="mono font-semibold text-xs text-[var(--text)]">
                  {item.price || '—'}
                </td>
                <td className="text-xs text-[var(--text-sec)] max-w-[360px] truncate">
                  {item.description}
                </td>
                <td className="mono text-xs text-[var(--success)]">
                  {vec ? `${vec.length}d · L2=1.0` : 'Pending'}
                </td>
                <td className="text-right">
                  <div className="inline-flex items-center gap-1.5">
                    {onInspectIn3D && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onInspectIn3D(item);
                        }}
                        title="Locate in 3D Vector Space"
                      >
                        <Boxes size={12} />
                      </button>
                    )}
                    {onSelectItem && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectItem(item);
                        }}
                        title="Inspect MMR Recommendations"
                      >
                        <Lightbulb size={12} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteItem(item.id);
                      }}
                      title="Delete SKU"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
