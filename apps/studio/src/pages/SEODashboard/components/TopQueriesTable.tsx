import React, { useState, useMemo } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Filter,
  Calendar,
  Microscope,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  TopQueryItem,
  SortColumn,
  SortDirection,
  DateRangeFilter,
} from '../types';

export interface TopQueriesTableProps {
  id?: string;
  queries: TopQueryItem[];
  dateRange: DateRangeFilter;
  onChangeDateRange: (next: DateRangeFilter) => void;
  onInspectQuery: (query: string) => void;
  onQuickFixZeroResult?: (query: string) => void;
}

export const TopQueriesTable: React.FC<TopQueriesTableProps> = ({
  id,
  queries,
  dateRange,
  onChangeDateRange,
  onInspectQuery,
  onQuickFixZeroResult,
}) => {
  const [sortColumn, setSortColumn] = useState<SortColumn>('volume');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [zeroResultOnly, setZeroResultOnly] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDirection(col === 'query' ? 'asc' : 'desc');
    }
  };

  const applyPreset = (preset: '7d' | '14d' | '30d') => {
    const to = '2026-04-07';
    const from =
      preset === '7d'
        ? '2026-04-01'
        : preset === '14d'
        ? '2026-03-25'
        : '2026-03-09';
    onChangeDateRange({ from, to, preset });
  };

  const filteredAndSorted = useMemo(() => {
    const cleanSearch = searchFilter.trim().toLowerCase();

    const filtered = queries.filter((item) => {
      if (zeroResultOnly && !item.zeroResult) return false;
      if (cleanSearch && !item.query.toLowerCase().includes(cleanSearch)) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'query':
          cmp = a.query.localeCompare(b.query, 'ru');
          break;
        case 'volume':
          cmp = a.volume - b.volume;
          break;
        case 'ctr':
          cmp = a.ctr - b.ctr;
          break;
        case 'avgPosition':
          cmp = a.avgPosition - b.avgPosition;
          break;
        case 'zeroResult':
          cmp = Number(a.zeroResult) - Number(b.zeroResult);
          break;
        case 'revenue':
          cmp = a.revenue - b.revenue;
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [queries, zeroResultOnly, searchFilter, sortColumn, sortDirection]);

  const renderSortIcon = (col: SortColumn) => {
    if (sortColumn !== col) {
      return <ArrowUpDown size={12} className="text-slate-500" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp size={12} className="text-[#3b82f6]" />
    ) : (
      <ArrowDown size={12} className="text-[#3b82f6]" />
    );
  };

  return (
    <div
      id={id}
      className="rounded-lg bg-[#1e293b] border border-slate-700/80 overflow-hidden"
    >
      {/* DataViews Header & Filter Toolbar */}
      <div className="p-4 border-b border-slate-700/80 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[#f1f5f9] uppercase tracking-wider">
              Top Search Queries (DataViews)
            </h2>
            <span className="px-2 py-0.5 text-[11px] font-mono tabular-nums rounded bg-slate-800 text-slate-300 border border-slate-700">
              {filteredAndSorted.length} из {queries.length}
            </span>
          </div>
          <p className="text-[12px] text-slate-400 mt-0.5">
            Кликните по заголовку колонки для сортировки или выберите запрос для X-Ray инспекции
          </p>
        </div>

        {/* Filters Row: Search + Zero-Result Only + Date Range */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Substring Filter */}
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Фильтр по запросу..."
              className="pl-8 pr-3 py-1.5 rounded bg-[#0f172a] border border-slate-700 text-[12px] text-[#f1f5f9] placeholder-slate-500 focus:outline-none focus:border-[#3b82f6] w-44"
            />
          </div>

          {/* Zero-Result Only Toggle */}
          <button
            type="button"
            onClick={() => setZeroResultOnly((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[12px] font-medium border transition-colors cursor-pointer ${
              zeroResultOnly
                ? 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/50'
                : 'bg-[#0f172a] text-slate-300 border-slate-700 hover:border-slate-600'
            }`}
          >
            <Filter size={12} />
            <span>Zero-Result only</span>
          </button>

          {/* Date Range Picker & Presets */}
          <div className="flex items-center gap-1 bg-[#0f172a] px-2 py-1 rounded border border-slate-700 text-[12px]">
            <Calendar size={12} className="text-slate-400 mr-1" />
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) =>
                onChangeDateRange({
                  ...dateRange,
                  from: e.target.value,
                  preset: 'custom',
                })
              }
              className="bg-transparent text-[#f1f5f9] font-mono text-[11px] focus:outline-none"
              aria-label="Date from"
            />
            <span className="text-slate-500">—</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) =>
                onChangeDateRange({
                  ...dateRange,
                  to: e.target.value,
                  preset: 'custom',
                })
              }
              className="bg-transparent text-[#f1f5f9] font-mono text-[11px] focus:outline-none"
              aria-label="Date to"
            />
            <div className="flex items-center gap-0.5 ml-1 pl-1 border-l border-slate-700">
              {(['7d', '14d', '30d'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono cursor-pointer ${
                    dateRange.preset === p
                      ? 'bg-[#3b82f6] text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* High-Density DataViews Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#0f172a]/70 border-b border-slate-700/80 text-[12px] font-semibold text-slate-400">
              <th className="py-2.5 px-4">
                <button
                  type="button"
                  onClick={() => handleSort('query')}
                  className="inline-flex items-center gap-1.5 hover:text-[#f1f5f9] cursor-pointer"
                >
                  <span>Query</span>
                  {renderSortIcon('query')}
                </button>
              </th>
              <th className="py-2.5 px-3 text-right">
                <button
                  type="button"
                  onClick={() => handleSort('volume')}
                  className="inline-flex items-center justify-end gap-1.5 hover:text-[#f1f5f9] ml-auto cursor-pointer"
                >
                  <span>Search Volume</span>
                  {renderSortIcon('volume')}
                </button>
              </th>
              <th className="py-2.5 px-3 text-right">
                <button
                  type="button"
                  onClick={() => handleSort('ctr')}
                  className="inline-flex items-center justify-end gap-1.5 hover:text-[#f1f5f9] ml-auto cursor-pointer"
                >
                  <span>CTR</span>
                  {renderSortIcon('ctr')}
                </button>
              </th>
              <th className="py-2.5 px-3 text-right">
                <button
                  type="button"
                  onClick={() => handleSort('avgPosition')}
                  className="inline-flex items-center justify-end gap-1.5 hover:text-[#f1f5f9] ml-auto cursor-pointer"
                >
                  <span>Avg Click Position</span>
                  {renderSortIcon('avgPosition')}
                </button>
              </th>
              <th className="py-2.5 px-3 text-center">
                <button
                  type="button"
                  onClick={() => handleSort('zeroResult')}
                  className="inline-flex items-center justify-center gap-1.5 hover:text-[#f1f5f9] mx-auto cursor-pointer"
                >
                  <span>Zero-Result</span>
                  {renderSortIcon('zeroResult')}
                </button>
              </th>
              <th className="py-2.5 px-3 text-right">
                <button
                  type="button"
                  onClick={() => handleSort('revenue')}
                  className="inline-flex items-center justify-end gap-1.5 hover:text-[#f1f5f9] ml-auto cursor-pointer"
                >
                  <span>Revenue</span>
                  {renderSortIcon('revenue')}
                </button>
              </th>
              <th className="py-2.5 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-[13px]">
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400 text-[13px]">
                  Нет поисковых запросов, соответствующих выбранным фильтрам.
                </td>
              </tr>
            ) : (
              filteredAndSorted.map((row) => {
                const isHighCtr = row.ctr >= 35;
                return (
                  <tr
                    key={row.query}
                    className="h-10 hover:bg-slate-800/70 transition-colors group"
                  >
                    <td className="py-2 px-4 font-medium text-[#f1f5f9]">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[240px]">{row.query}</span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-200">
                      {row.volume.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums">
                      <span
                        className={`font-semibold ${
                          row.zeroResult
                            ? 'text-[#ef4444]'
                            : isHighCtr
                            ? 'text-[#22c55e]'
                            : 'text-[#3b82f6]'
                        }`}
                      >
                        {row.ctr.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-300">
                      {row.zeroResult ? '—' : `#${row.avgPosition.toFixed(1)}`}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {row.zeroResult ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/40">
                          <AlertCircle size={11} />
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-[#22c55e]/15 text-[#22c55e]">
                          <CheckCircle2 size={11} />
                          No
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-[#f1f5f9]">
                      ${row.revenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {row.zeroResult && onQuickFixZeroResult && (
                          <button
                            type="button"
                            onClick={() => onQuickFixZeroResult(row.query)}
                            className="px-2 py-1 rounded text-[11px] font-medium bg-[#ef4444]/20 text-[#ef4444] hover:bg-[#ef4444]/30 border border-[#ef4444]/40 cursor-pointer"
                          >
                            + Synonym
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onInspectQuery(row.query)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-[#3b82f6]/15 text-[#3b82f6] hover:bg-[#3b82f6]/25 border border-[#3b82f6]/30 cursor-pointer"
                          title="Открыть в Explainable X-Ray Inspector"
                        >
                          <Microscope size={12} />
                          <span>X-Ray</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
