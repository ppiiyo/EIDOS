import React, { useState } from 'react';
import {
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Cpu,
  FileSearch,
  Shuffle,
  TrendingUp,
  AlertOctagon,
  DollarSign,
} from 'lucide-react';

export interface HowToReadPanelProps {
  id?: string;
  defaultOpen?: boolean;
}

const METRIC_EXPLANATIONS = [
  {
    title: 'Dense Component (Семантический смысл · HNSW 384-d)',
    badge: '0.00 – 1.00',
    color: 'text-[#3b82f6] bg-[#3b82f6]/15 border-[#3b82f6]/30',
    icon: Cpu,
    text: 'Показывает, насколько вектор смысла запроса совпадает с вектором товара (all-MiniLM-L6-v2). Высокий Dense Score (> 0.70) позволяет находить товары даже при опечатках, синонимах или описательных запросах («наушники для перелётов»).',
  },
  {
    title: 'Sparse Component (Точное совпадение слов · BM25)',
    badge: '0.0 – 35.0+',
    color: 'text-[#22c55e] bg-[#22c55e]/15 border-[#22c55e]/30',
    icon: FileSearch,
    text: 'Классический лексический вес BM25: учитывает точное вхождение артикулов, брендов (Nike, Sony) и редких ключевых слов в заголовке и тегах товара.',
  },
  {
    title: 'MMR Penalty (Штраф за дубликаты в Топ-5)',
    badge: '0.00 – 0.30',
    color: 'text-[#ef4444] bg-[#ef4444]/15 border-[#ef4444]/30',
    icon: Shuffle,
    text: 'Maximal Marginal Relevance предотвращает выдачу 5 одинаковых вариаций одного товара подряд. Если товар слишком похож на позицию #1, MMR слегка снижает его итоговый ранг для разнообразия витрины.',
  },
  {
    title: 'Business Boost (Мерчандайзинг и онлайн-обучение LinUCB)',
    badge: '+0.05 – +2.00',
    color: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
    icon: TrendingUp,
    text: 'Дополнительный вес от кликов/покупок (POST /v1/feedback) и ручных правил продвижения высокомаржинальных товаров SEO-специалистом.',
  },
  {
    title: 'Zero-Result Rate (Доля пустых поисковых выдач)',
    badge: 'Норма < 10%',
    color: 'text-[#ef4444] bg-[#ef4444]/15 border-[#ef4444]/30',
    icon: AlertOctagon,
    text: 'Процент поисковых запросов, которые вернули 0 товаров. Если показатель превышает 10% (красный индикатор), магазин теряет горячий органический спрос — добавьте синонимы в блоке Zero-Result Queries.',
  },
  {
    title: 'Revenue per Search & CTR (Конверсионная отдача поиска)',
    badge: 'KPI e-commerce',
    color: 'text-[#22c55e] bg-[#22c55e]/15 border-[#22c55e]/30',
    icon: DollarSign,
    text: 'Показывает среднюю выручку на один поисковый запрос и долю поисковых сессий с кликом по результатам. Прямой индикатор качества ранжирования.',
  },
];

export const HowToReadPanel: React.FC<HowToReadPanelProps> = ({
  id,
  defaultOpen = true,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);

  return (
    <div
      id={id}
      className="rounded-lg bg-[#1e293b] border border-slate-700/80 overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-800/60 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <HelpCircle size={16} className="text-[#3b82f6]" />
          <span className="text-sm font-semibold text-[#f1f5f9] uppercase tracking-wider">
            How to read this data (Справочник SEO-специалиста)
          </span>
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#0f172a] text-slate-400 border border-slate-700">
            SEOPress / Doofinder X-Ray Guide
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[12px] text-slate-400">
          <span>{isOpen ? 'Свернуть' : 'Развернуть объяснение метрик'}</span>
          {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 pt-2 border-t border-slate-700/80 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 bg-[#0f172a]/40">
          {METRIC_EXPLANATIONS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="p-3 rounded bg-[#0f172a] border border-slate-800 flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <Icon size={14} className="text-[#3b82f6] shrink-0" />
                      <h3 className="text-[12px] font-semibold text-[#f1f5f9] leading-snug">
                        {item.title}
                      </h3>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border shrink-0 ${item.color}`}
                    >
                      {item.badge}
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-400 leading-relaxed">
                    {item.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
